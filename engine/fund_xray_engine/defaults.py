"""Default settings for a new user.

Personal numbers (index target, monthly amount) are settings each user edits on the Settings page,
never values written into code. `monthly_amount` starts empty on purpose.
"""

from dataclasses import dataclass, field, asdict


@dataclass(frozen=True)
class UserSettings:
    benchmark: str = "NIFTY 500"
    index_target_low_pct: float = 20.0
    index_target_high_pct: float = 30.0
    monthly_amount_inr: int | None = None
    theme: str = "day"
    # Alert thresholds (starting values from the spec; tune later)
    sector_quadrant_alert_min_weight_pct: float = 10.0
    weak_share_weekly_jump_pts: float = 5.0
    single_stock_max_weight_pct: float = 8.0
    exit_liquidity_max_days: float = 5.0
    news_alert_abs_score: float = 0.3
    # Rotation engine parameters.
    # Index names are placeholders: on Day 6, check each against Kite's instruments list
    # (segment "INDICES") and correct the spelling there.
    ratio_window_days: int = 50
    momentum_lag_days: int = 10
    regime_threshold: float = 2.0
    tracked_indices: tuple[str, ...] = field(
        default_factory=lambda: (
            "NIFTY 50", "NIFTY 500", "NIFTY SMLCAP 250",
            "NIFTY BANK", "NIFTY PSU BANK", "NIFTY FIN SERVICE", "NIFTY IT", "NIFTY PHARMA",
            "NIFTY HEALTHCARE", "NIFTY FMCG", "NIFTY AUTO", "NIFTY METAL", "NIFTY ENERGY",
            "NIFTY REALTY", "NIFTY INFRA", "NIFTY CPSE", "NIFTY PSE", "NIFTY MEDIA",
            "NIFTY CONSR DURBL", "NIFTY OIL AND GAS", "NIFTY IND DEFENCE", "NIFTY COMMODITIES",
        )
    )

    def as_dict(self) -> dict:
        d = asdict(self)
        d["tracked_indices"] = list(self.tracked_indices)
        return d


DEFAULT_SETTINGS = UserSettings()
