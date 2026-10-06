from rest_framework import serializers
from .models import *


class ProductsSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductDetails
        fields = "__all__"


class PurchaseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Purchases
        fields = "__all__"


class SalesSerializer(serializers.ModelSerializer):
    class Meta:
        model = Sales
        fields = "__all__"



class PlatformSerializer(serializers.ModelSerializer):
    class Meta:
        model = Platforms
        fields = "__all__"


class SuppliersSerializer(serializers.ModelSerializer):
    class Meta:
        model = Suppliers
        fields = "__all__"


class ProductCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductCategory
        fields = "__all__"


class PurchaseLogsSerializer(serializers.ModelSerializer):
    class Meta:
        model = PurchaseLogs
        fields = "__all__"


class ReturnsSerializer(serializers.ModelSerializer):
    class Meta:
        model = Returns
        fields = "__all__"