from rest_framework import serializers
from .models import ProductDetails
from .models import Purchases
from .models import Sales


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