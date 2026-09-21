from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


def _empty_str_to_none(value: Any) -> Any:
    if isinstance(value, str) and not value.strip():
        return None
    return value


class HousingComplexUpdate(BaseModel):
    """Accepts name/title, address/district, build_year/year_built."""

    name: str | None = Field(None, max_length=255)
    title: str | None = Field(None, max_length=255)  # alias for name
    district: str | None = None
    address: str | None = None
    build_year: int | None = None
    year_built: int | None = None  # alias for build_year

    @field_validator("district", "address", "name", "title", mode="before")
    @classmethod
    def blank_to_none(cls, value: Any) -> Any:
        return _empty_str_to_none(value)

    @field_validator("build_year", "year_built", mode="before")
    @classmethod
    def coerce_year(cls, value: Any) -> int | None:
        if value is None or value == "":
            return None
        if isinstance(value, str):
            text = value.strip()
            if not text:
                return None
            value = text
        try:
            year = int(value)
        except (TypeError, ValueError) as exc:
            raise ValueError("Год постройки должен быть числом или пустым") from exc
        if year < 1900 or year > 2100:
            raise ValueError("Год постройки должен быть в диапазоне 1900–2100")
        return year

    @model_validator(mode="after")
    def merge_aliases(self) -> "HousingComplexUpdate":
        if self.name is None and self.title is not None:
            self.name = self.title
        if self.build_year is None and self.year_built is not None:
            self.build_year = self.year_built
        return self


class HousingComplexRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    district: str | None = None
    address: str | None = None
    build_year: int | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
