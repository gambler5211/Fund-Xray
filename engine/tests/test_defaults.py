from fund_xray_engine import DEFAULT_SETTINGS


def test_defaults_have_no_personal_amount():
    assert DEFAULT_SETTINGS.monthly_amount_inr is None


def test_index_band_is_ordered():
    assert DEFAULT_SETTINGS.index_target_low_pct < DEFAULT_SETTINGS.index_target_high_pct


def test_benchmark_is_tracked():
    assert DEFAULT_SETTINGS.benchmark in DEFAULT_SETTINGS.tracked_indices
