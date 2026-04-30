from __future__ import annotations

from dataclasses import dataclass


@dataclass
class NotificationPayload:
    recipient: str
    channel: str
    message: str


class NotificationService:
    """Stub for SMS/call integrations such as Twilio or local emergency gateways."""

    def prepare_sms(self, recipient: str, message: str) -> NotificationPayload:
        return NotificationPayload(
            recipient=recipient,
            channel="sms",
            message=message,
        )
