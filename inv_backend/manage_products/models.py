from django.db import models


class ProductCategory(models.Model):
    category_name = models.CharField(max_length=300)
    status = models.BooleanField()
    created_at =models.DateTimeField(auto_now_add=True)


class ProductDetails(models.Model):
    product_id = models.PositiveIntegerField(unique = True)
    product_name = models.CharField(max_length=200)
    brand_name = models.CharField(max_length=200)
    category_id = models.ForeignKey(ProductCategory,on_delete=models.CASCADE)
    sku = models.CharField(max_length=200)
    size = models.CharField(max_length=10)
    color = models.CharField(max_length=20)
    purchase_price = models.DecimalField(max_digits=20, decimal_places=2)
    selling_price = models.DecimalField(max_digits=20, decimal_places=2)
    stock_quantity = models.PositiveIntegerField()
    reorder_level = models.CharField(max_length=20, null=True, blank=True)
    status = models.BooleanField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now_add=True)

class Suppliers(models.Model):
    supplier_name = models.CharField(max_length=200)
    supplier_phone = models.PositiveIntegerField()
    supplier_email = models.CharField(max_length=50)
    supplier_address = models.CharField(max_length=400)
    status = models.BooleanField()
    created_at = models.DateTimeField(auto_now_add=True)

class Purchases(models.Model):
    supplier_id = models.ForeignKey(Suppliers,on_delete=models.CASCADE)
    product_id = models.ForeignKey(ProductDetails,on_delete=models.CASCADE)
    quantity = models.PositiveIntegerField()
    purchase_price = models.DecimalField(max_digits=20, decimal_places=2)
    total_amount = models.DecimalField(max_digits=20, decimal_places=2)
    purchase_date = models.DateTimeField(auto_now_add=True)

class Platforms(models.Model):
    platform_name = models.CharField(max_length=100)
    status = models.BooleanField(default=True)

class Sales(models.Model):
    platform_id = models.ForeignKey(Platforms, on_delete=models.CASCADE)
    product_id = models.ForeignKey(ProductDetails, on_delete=models.CASCADE)
    order_id = models.CharField(max_length=200)
    quantity = models.PositiveIntegerField()
    selling_price = models.DecimalField(max_digits=20, decimal_places=2)
    total_amount = models.DecimalField(max_digits=20, decimal_places=2)
    Sell_date = models.DateTimeField(auto_now_add=True)
    status = models.BooleanField()