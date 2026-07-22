"""FastAPI application wiring the bridge together.

Pure orchestration — structure detection lives in ``smc_features``,
gating in ``risk_gate``, ai_brain glue in ``translator``, persistence in
``trade_state``. Every request, response, execution, error, and
rejection is logged via ``bridge.logging_setup.log_event``.
"""

from __future__ import annotations

import logging
import secrets
import traceback

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.responses import JSONResponse

import ai_brain
from ai_brain.utils import get_session

from bridge import risk_gate, trade_state, translator
from bridge.config import CONFIG
from bridge.logging_setup import get_logger, log_event
from bridge.schemas import (
    HealthResponse,
    PredictRequest,
    PredictResponse,
    TradeResultRequest,
    TradeResultResponse,
)
from bridge.smc_features import InsufficientDataError, bars_from_dicts, detect

app = FastAPI(title="MMXM MT5 Bridge", version="1.0.0")
logger = get_logger("bridge.app")

if not CONFIG.is_bound_to_loopback() and not CONFIG.api_key:
    log_event(
        logger, "WARNING", level=logging.WARNING,
        message=(
            f"Bridge is bound to non-loopback host '{CONFIG.host}' with no "
            "security.api_key configured — /predict and /trade_result are "
            "reachable by anyone who can reach this port, and /trade_result "
            "in particular lets them inject fabricated trade outcomes "
            "straight into ai_brain's training data. Set security.api_key "
            "in config/bridge_config.yaml."
        ),
    )


async def require_api_key(x_api_key: str | None = Header(default=None)) -> None:
    """Shared-secret gate for /predict and /trade_result. A no-op when
    ``security.api_key`` isn't configured, preserving today's
    localhost-only-by-default behavior — but see the startup warning
    above for why leaving it empty on a non-loopback host is a real
    exposure, not just a formality.
    """
    if not CONFIG.api_key:
        return
    if not x_api_key or not secrets.compare_digest(x_api_key, CONFIG.api_key):
        raise HTTPException(status_code=401, detail="invalid_or_missing_api_key")


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Last-resort safety net: without this, an unexpected error anywhere
    in a route (a bad config value, an ai_brain edge case) produces a
    bare framework 500 that never touches bridge.log — violating the
    "log every error" requirement. This guarantees every failure is
    logged with a full traceback and the EA still gets back a clean
    JSON body (it only acts on 2xx responses either way).
    """
    log_event(
        logger, "ERROR", level=logging.ERROR,
        path=request.url.path, method=request.method,
        exception=repr(exc), traceback=traceback.format_exc(),
    )
    return JSONResponse(status_code=500, content={"detail": "internal_server_error"})


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(status="ok", ai_brain_enabled=ai_brain.is_enabled())


def _reject(request_id: str, reason: str, confidence: float = 0.0, explanation: str = "") -> PredictResponse:
    log_event(logger, "REJECTED", request_id=request_id, reason=reason)
    return translator.hold_response(request_id, reason, confidence=confidence, explanation=explanation)


@app.post("/predict", response_model=PredictResponse, dependencies=[Depends(require_api_key)])
async def predict(request: PredictRequest) -> PredictResponse:
    log_event(
        logger, "REQUEST", request_id=request.request_id, symbol=request.symbol,
        timeframe=request.timeframe, spread=request.spread, bar_count=len(request.ohlc),
    )

    session = get_session(request.timestamp)
    pre_gate = risk_gate.pre_checks(
        CONFIG,
        symbol=request.symbol,
        session=session,
        timestamp=request.timestamp,
        spread=request.spread,
        open_positions=request.account.open_positions,
    )
    if not pre_gate.approved:
        return _reject(request.request_id, pre_gate.rejected_reason)

    try:
        bars = bars_from_dicts([b.model_dump() for b in request.ohlc])
        signals = detect(bars)
    except InsufficientDataError:
        return _reject(request.request_id, "insufficient_bar_data")

    if signals.direction_bias is None:
        return _reject(request.request_id, "no_directional_signal")

    candidate = translator.build_candidate_trade(request, signals, CONFIG)
    account_risk = translator.build_account_risk_settings(request, candidate, CONFIG)

    decision = ai_brain.get_prediction(candidate, account_risk=account_risk)
    log_event(
        logger, "RESPONSE", request_id=request.request_id, recommendation=decision.recommendation,
        confidence=decision.final_confidence, data_sufficient=decision.data_sufficient,
    )

    post_gate = risk_gate.post_checks(
        CONFIG,
        recommendation=decision.recommendation,
        final_confidence=decision.final_confidence,
        data_sufficient=decision.data_sufficient,
    )
    if not post_gate.approved:
        reason = translator.refine_rejection_reason(post_gate.rejected_reason, decision)
        return _reject(
            request.request_id, reason,
            confidence=decision.final_confidence, explanation=decision.explanation.summary,
        )

    response = translator.approved_response(request.request_id, candidate, decision, CONFIG)
    trade_state.save_pending_trade(translator.context_from_candidate(candidate, decision))
    log_event(
        logger, "EXECUTION", request_id=request.request_id, action=response.action,
        lot_size=response.lot_size, stop_loss=response.stop_loss, take_profit=response.take_profit,
        risk_percent=response.risk_percent,
    )
    return response


@app.post("/trade_result", response_model=TradeResultResponse, dependencies=[Depends(require_api_key)])
async def trade_result(result: TradeResultRequest) -> TradeResultResponse:
    log_event(
        logger, "TRADE_RESULT", trade_id=result.trade_id, symbol=result.symbol,
        outcome=result.outcome, pnl=result.pnl, exit_reason=result.exit_reason,
    )

    context = trade_state.get_pending_trade(result.trade_id)
    record = translator.build_trade_record(result, context)

    try:
        # ai_brain.record_trade is itself an exception-safe boundary and
        # never raises, but this endpoint guards too — a trade-close
        # report must never 500 regardless of what's on the other side.
        ai_brain.record_trade(record)
    except Exception:
        log_event(logger, "ERROR", level=logging.ERROR, trade_id=result.trade_id, message="record_trade raised unexpectedly")
        return TradeResultResponse(trade_id=result.trade_id, recorded=False, message="internal error recording trade")

    trade_state.delete_pending_trade(result.trade_id)
    message = "ok" if context is not None else "recorded without original candidate context"
    return TradeResultResponse(trade_id=result.trade_id, recorded=True, message=message)
