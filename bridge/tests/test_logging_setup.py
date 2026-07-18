import logging

from bridge.logging_setup import get_logger, log_event


def test_get_logger_is_idempotent(tmp_bridge_config):
    logger1 = get_logger("bridge.test_a")
    logger2 = get_logger("bridge.test_a")
    assert logger1 is logger2
    assert len(logger1.handlers) == 2  # file + stream, not duplicated


def test_log_file_created_and_written(tmp_bridge_config):
    logger = get_logger("bridge.test_b")
    log_event(logger, "REQUEST", request_id="abc123", symbol="EURUSD")

    log_path = tmp_bridge_config.logs_dir / "bridge.log"
    assert log_path.exists()
    content = log_path.read_text()
    assert "REQUEST" in content
    assert "abc123" in content


def test_log_event_error_level(tmp_bridge_config):
    # The bridge logger has propagate=False (it owns its own handlers),
    # so pytest's caplog (which hooks the root logger) can't see it;
    # assert against the actual log file instead.
    logger = get_logger("bridge.test_c")
    log_event(logger, "ERROR", level=logging.ERROR, reason="boom")

    content = (tmp_bridge_config.logs_dir / "bridge.log").read_text()
    assert "ERROR" in content
    assert "boom" in content
