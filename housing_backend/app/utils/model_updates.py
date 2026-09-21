from pydantic import BaseModel


def apply_updates(model: object, update: BaseModel) -> None:
    data = update.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(model, key, value)
