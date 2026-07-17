import pytest

from ai_brain import model_manager
from ai_brain.xgboost_engine import ModelBundle


def _dummy_bundle(version="vX") -> ModelBundle:
    return ModelBundle(
        classifier=object(),
        rr_regressor=object(),
        profit_regressor=object(),
        feature_columns=["atr"],
        encoders={},
        version=version,
        trained_at="2026-01-01T00:00:00+00:00",
        metrics={},
    )


def test_load_model_raises_when_no_models(tmp_config):
    with pytest.raises(model_manager.NoModelAvailableError):
        model_manager.load_model()


def test_save_model_never_overwrites_existing_version(tmp_config, monkeypatch):
    monkeypatch.setattr(model_manager, "next_version", lambda: "v1")
    model_manager.save_model(_dummy_bundle(), metrics={"combined_score": 0.5}, trigger_reason="test", trades_used=10)

    with pytest.raises(model_manager.ModelVersionExistsError):
        model_manager.save_model(_dummy_bundle(), metrics={"combined_score": 0.6}, trigger_reason="test", trades_used=10)


def test_save_and_activate(tmp_config):
    version = model_manager.save_model(
        _dummy_bundle(), metrics={"combined_score": 0.7}, trigger_reason="test", trades_used=10, activate=True
    )
    assert model_manager.get_active_version() == version
    loaded = model_manager.load_model()
    assert loaded.version == version


def test_rollback_flips_active_correctly(tmp_config):
    v1 = model_manager.save_model(_dummy_bundle("v1"), metrics={}, trigger_reason="t", trades_used=1, activate=True)
    v2 = model_manager.save_model(_dummy_bundle("v2"), metrics={}, trigger_reason="t", trades_used=1, activate=True)

    assert model_manager.get_active_version() == v2

    rolled_to = model_manager.rollback(v1)
    assert rolled_to == v1
    assert model_manager.get_active_version() == v1

    versions = {v.version: v for v in model_manager.list_versions()}
    assert versions[v1].is_active is True
    assert versions[v2].is_active is False


def test_set_active_unknown_version_raises(tmp_config):
    model_manager.save_model(_dummy_bundle("v1"), metrics={}, trigger_reason="t", trades_used=1, activate=True)
    with pytest.raises(model_manager.ModelVersionNotFoundError):
        model_manager.set_active("v_does_not_exist")


def test_list_versions_empty_initially(tmp_config):
    assert model_manager.list_versions() == []
