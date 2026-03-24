from django import forms
from django.core.exceptions import ValidationError

from .models import WorkTimeEntry


class WorkTimeEntryForm(forms.ModelForm):
    class Meta:
        model = WorkTimeEntry
        fields = "__all__"

    def clean(self):
        cleaned_data = super().clean()

        status_value = cleaned_data.get("status")
        started_at = cleaned_data.get("started_at")
        ended_at = cleaned_data.get("ended_at")
        approved_at = cleaned_data.get("approved_at")
        approved_by = cleaned_data.get("approved_by")
        rejected_at = cleaned_data.get("rejected_at")
        rejected_by = cleaned_data.get("rejected_by")
        break_minutes = cleaned_data.get("break_minutes") or 0
        work_date = cleaned_data.get("work_date")

        if ended_at and started_at and ended_at <= started_at:
            self.add_error("ended_at", "End time must be later than start time.")

        if break_minutes < 0:
            self.add_error("break_minutes", "Break minutes cannot be negative.")

        if status_value == WorkTimeEntry.Status.RUNNING and ended_at:
            self.add_error("status", "A running entry cannot already have an end time.")

        if status_value != WorkTimeEntry.Status.RUNNING and not ended_at:
            self.add_error("ended_at", "A finished entry must have an end time.")

        if status_value == WorkTimeEntry.Status.APPROVED:
            if not approved_at:
                self.add_error("approved_at", "Approved entries must have approved_at.")
            if not approved_by:
                self.add_error("approved_by", "Approved entries must have approved_by.")

        if status_value == WorkTimeEntry.Status.REJECTED:
            if not rejected_at:
                self.add_error("rejected_at", "Rejected entries must have rejected_at.")
            if not rejected_by:
                self.add_error("rejected_by", "Rejected entries must have rejected_by.")

        if work_date and started_at:
            local_started_date = started_at.astimezone().date()
            if work_date != local_started_date:
                self.add_error(
                    "work_date",
                    "work_date must match the local date of started_at.",
                )

        return cleaned_data