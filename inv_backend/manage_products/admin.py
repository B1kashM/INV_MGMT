from django.contrib import admin
from .models import *




@admin.register(Platforms)
class Platformsclass(admin.ModelAdmin):
    list_display=(
        "platform_name",
        "status")


@admin.register(ProductCategory)
class ProductCategoryclass(admin.ModelAdmin):
    list_display=(
        "category_name",
        "status",
        "created_at")



@admin.register(ProductDetails)
class ProductDetailsClass(admin.ModelAdmin):
    list_display=(
        "product_id",
        "product_name",
        "brand_name",
        "category_id",
        "sku",
        "size",
        "color",
        "purchase_price",
        "selling_price",
        "stock_quantity",
        "reorder_level",
        "status",
        "created_at",
        "updated_at"
    )



@admin.register(Purchases)
class PurchaseClass(admin.ModelAdmin):
    list_display=(
        "supplier_id",
        "product_id",
        "quantity",
        "purchase_price",
        "total_amount",
        "purchase_date"
    )




@admin.register(Sales)
class SalesClass(admin.ModelAdmin):
    list_display=(
        "platform_id",
        "product_id",
        "order_id",
        "quantity",
        "selling_price",
        "total_amount",
        "Sell_date",
        "status"
    )




@admin.register(Suppliers)
class SuppliersClass(admin.ModelAdmin):
    list_display=(
        "supplier_name",
        "supplier_phone",
        "supplier_email",
        "supplier_address",
        "status",
        "created_at"
    )