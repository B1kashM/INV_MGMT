from django.contrib import admin
from django.urls import path
from .views import *

urlpatterns = [
    path("heartbeat/", heartbeat),
    path("add_product/", add_product),
    path("update_product/<int:product_id>", update_product),
    path("delete_product/<int:product_id>", delete_product),
    path("add_purchase/", add_purchase),
    path("add_sales/", add_sales)
    ]
