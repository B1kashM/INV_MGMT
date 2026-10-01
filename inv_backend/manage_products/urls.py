from django.contrib import admin
from django.urls import path
from .views import *

urlpatterns = [
    path("heartbeat/", heartbeat),
    path("add_product/", add_product),
    path("get_product/", get_product),
    path("update_product/<int:product_id>", update_product),
    path("delete_product/<int:product_id>", delete_product),
    path("add_purchase/", add_purchase),
    path("add_sales/", add_sales),
    path("get_sales/", get_sales),
    path("delete_sales/<int:sales_id>", delete_sales),
    path("update_sales/<int:sales_id>", update_sales),
    path("add_purchase/", add_purchase),
    path("get_purchase/", get_purchase),
    path("delete_purchase/<int:purchase_id>", delete_purchase),
    path("update_purchase/<int:purchase_id>", update_purchase),
    path("add_platform/", add_platform),
    path("get_platform/", get_platform),
    path("delete_platform/<int:platform_id>", delete_platform),
    path("update_platform/<int:platform_id>", update_platform),
    path("add_supplier/", add_supplier),
    path("get_supplier/", get_supplier),
    path("delete_supplier/<int:supplier_id>", delete_supplier),
    path("update_supplier/<int:supplier_id>", update_supplier),
    path("add_category/", add_category),
    path("get_category/", get_category),
    path("delete_category/<int:category_id>", delete_category),
    path("update_category/<int:category_id>", update_category),
    ]