import pandas as pd
import pytest

from ai_brain import dataset_builder

from .conftest import make_trade_record


def test_rejects_open_trade(tmp_config):
    trade = make_trade_record(is_closed=False)
    with pytest.raises(dataset_builder.InvalidTradeError):
        dataset_builder.append_closed_trade(trade)


def test_append_is_idempotent_on_trade_id(tmp_config):
    trade = make_trade_record(trade_id="dup-1")
    dataset_builder.append_closed_trade(trade)
    dataset_builder.append_closed_trade(trade)  # re-recording same id

    df = dataset_builder.get_closed_trades_df()
    assert len(df[df["trade_id"] == "dup-1"]) == 1


def test_append_writes_csv_row(tmp_config):
    trade = make_trade_record(trade_id="csv-1")
    dataset_builder.append_closed_trade(trade)

    df = pd.read_csv(tmp_config.TRAINING_DATASET_CSV)
    assert "csv-1" in df["trade_id"].values


def test_rebuild_drops_corrupted_rows(tmp_config):
    good = make_trade_record(trade_id="good-1", pnl=10.0)
    dataset_builder.append_closed_trade(good)

    # Directly corrupt the DB with a row missing a required numeric field,
    # bypassing append_closed_trade's own validation, to simulate data
    # corruption that rebuild_dataset_from_db must clean up.
    from ai_brain.utils import db_cursor

    with db_cursor(commit=True) as cur:
        cur.execute(
            "UPDATE trades SET pnl = NULL WHERE trade_id = ?",
            ("good-1",),
        )
    # Insert a second, genuinely corrupted trade with NULL pnl directly.
    bad = make_trade_record(trade_id="bad-1", pnl=10.0)
    dataset_builder.append_closed_trade(bad)
    with db_cursor(commit=True) as cur:
        cur.execute("UPDATE trades SET pnl = NULL WHERE trade_id = ?", ("bad-1",))

    df = dataset_builder.rebuild_dataset_from_db()
    assert "bad-1" not in df["trade_id"].values
    assert "good-1" not in df["trade_id"].values  # both were corrupted to NULL pnl


def test_rebuild_bumps_dataset_version(tmp_config):
    dataset_builder.append_closed_trade(make_trade_record(trade_id="v-1"))
    df1 = dataset_builder.rebuild_dataset_from_db()
    version1 = df1["dataset_version"].iloc[0]

    dataset_builder.append_closed_trade(make_trade_record(trade_id="v-2"))
    df2 = dataset_builder.rebuild_dataset_from_db()
    version2 = df2["dataset_version"].iloc[0]

    assert version2 > version1


def test_get_training_dataframe_rebuilds_when_csv_missing(tmp_config):
    dataset_builder.append_closed_trade(make_trade_record(trade_id="fresh-1"))
    assert tmp_config.TRAINING_DATASET_CSV.exists()  # append writes the CSV immediately

    # Simulate the CSV being missing entirely (e.g. a fresh checkout with
    # only the DB present); get_training_dataframe must rebuild it.
    tmp_config.TRAINING_DATASET_CSV.unlink()
    assert not tmp_config.TRAINING_DATASET_CSV.exists()

    df = dataset_builder.get_training_dataframe()
    assert "fresh-1" in df["trade_id"].values
    assert tmp_config.TRAINING_DATASET_CSV.exists()
