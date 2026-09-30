from django.shortcuts import render

from rest_framework.decorators import api_view
from rest_framework.response import Response
from .serializers import *





@api_view(["GET"])
def heartbeat(request):
    return Response({"name":"Bikash", "age": 23})

@api_view(["POST"])
def add_product(request):
    product_data = request.data
    data_serializer = ProductsSerializer(data = product_data)
    if not data_serializer.is_valid():
        return Response({"error":data_serializer.errors})
            
    data_serializer.save()
        

    return Response(data_serializer.is_valid())

@api_view(["PUT"])
def update_product(request, product_id):
    
    try:
        product = ProductDetails.objects.get(product_id=product_id)
    except ProductDetails.DoesNotExist:
        return Response({"error": "Product not found"}, status=404)

    data_serializer = ProductsSerializer(
        product,
        data=request.data,
        partial = True
    )

    if not data_serializer.is_valid():
        return Response(
            {"error": data_serializer.errors},
            status=400
        )

    data_serializer.save()

    return Response(data_serializer.data, status=200)


@api_view(["DELETE"])
def delete_product(request, product_id):
    try:
        product = ProductDetails.objects.get(product_id=product_id)
    except ProductDetails.DoesNotExist:
        return Response({"error":"Product not found"}, status = 404)

  

    product.delete()

    return Response({"Result": "This product has been deleted"})


@api_view(["POST"])
def add_purchase(request):
    purchase_data = request.data
    quantity = purchase_data["quantity"]
    purchase_price = purchase_data["purchase_price"]
    purchase_data["total_amount"] = quantity*purchase_price
    data_serializer = PurchaseSerializer(data = purchase_data)
    if not data_serializer.is_valid():
        return Response({"error":data_serializer.errors})
            
    data_serializer.save()
        

    return Response(data_serializer.is_valid())





@api_view(["POST"])
def add_sales(request):
    sales_data = request.data
    quantity = sales_data["quantity"]
    selling_price = sales_data["selling_price"]
    sales_data["total_amount"] = quantity*selling_price
    data_serializer = SalesSerializer(data = sales_data)
    if not data_serializer.is_valid():
        return Response({"error":data_serializer.errors})
            
    data_serializer.save()
        

    return Response(data_serializer.is_valid())