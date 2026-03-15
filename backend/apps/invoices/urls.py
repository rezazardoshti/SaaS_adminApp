# apps/invoices/urls.py

from rest_framework.routers import DefaultRouter

from .views import (
    AccountingContactViewSet,
    AccountingExportBatchViewSet,
    AccountingExportItemViewSet,
    InvoiceAttachmentViewSet,
    InvoiceLineViewSet,
    InvoicePaymentViewSet,
    InvoiceViewSet,
)

app_name = "invoices"

router = DefaultRouter()
router.register(r"invoices", InvoiceViewSet, basename="invoice")
router.register(r"invoice-lines", InvoiceLineViewSet, basename="invoice-line")
router.register(r"invoice-attachments", InvoiceAttachmentViewSet, basename="invoice-attachment")
router.register(r"invoice-payments", InvoicePaymentViewSet, basename="invoice-payment")
router.register(r"accounting-contacts", AccountingContactViewSet, basename="accounting-contact")
router.register(r"accounting-export-batches", AccountingExportBatchViewSet, basename="accounting-export-batch")
router.register(r"accounting-export-items", AccountingExportItemViewSet, basename="accounting-export-item")

urlpatterns = router.urls
