from django.shortcuts import render

from rest_framework.decorators import api_view
from rest_framework.response import Response
from .serializers import *
from .models import *


#HearBeat

@api_view(["GET"])
def heartbeat(request):
    return Response({"name":"Bikash", "age": 23})



#ProductDetails


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



@api_view(["GET"])
def get_product(request):
    product_obj = ProductDetails.objects.all()
    data_serializer = ProductsSerializer(product_obj, many=True)
    return Response(data_serializer.data)




@api_view(["DELETE"])
def delete_product(request, product_id):
    try:
        product = ProductDetails.objects.get(product_id=product_id)
    except ProductDetails.DoesNotExist:
        return Response({"error":"Product not found"}, status = 404)

  

    product.delete()

    return Response({"Result": "This product has been deleted"})




#Sales


@api_view(["GET"])
def get_sales(request):
    sales_obj = Sales.objects.all()
    data_serializer = SalesSerializer(sales_obj, many=True)
    return Response(data_serializer.data)


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


@api_view(["DELETE"])
def delete_sales(request, sales_id):
    try:
        product = Sales.objects.get(id=sales_id)
    except Sales.DoesNotExist:
        return Response({"error":"Sales not found"}, status = 404)

  

    product.delete()

    return Response({"Result": "This Sale has been deleted"})



@api_view(["PUT"])
def update_sales(request, sales_id):
    
    try:
        product = Sales.objects.get(id=sales_id)
    except Sales.DoesNotExist:
        return Response({"error": "Sales not found"}, status=404)

    data_serializer = SalesSerializer(
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



#Purchases



@api_view(["GET"])
def get_purchase(request):
    purchase_obj = Purchases.objects.all()
    data_serializer = PurchaseSerializer(purchase_obj, many=True).data
    for i in range(len(data_serializer)):
        data_serializer[i]["supplier_id"]=Suppliers.objects.get(id=data_serializer[i]["supplier_id"]).supplier_name
    for i in range(len(data_serializer)):
        data_serializer[i]["product_id"]=ProductDetails.objects.get(id=data_serializer[i]["product_id"]).product_name
    return Response(data_serializer)



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



@api_view(["DELETE"])
def delete_purchase(request, purchase_id):
    try:
        product = Purchases.objects.get(id=purchase_id)
    except Purchases.DoesNotExist:
        return Response({"error":"Purchase not found"}, status = 404)

  

    product.delete()

    return Response({"Result": "This Sale has been deleted"})



@api_view(["PUT"])
def update_purchase(request, purchase_id):
    
    try:
        product = Purchases.objects.get(id=purchase_id)
    except Purchases.DoesNotExist:
        return Response({"error": "Purchase not found"}, status=404)

    data_serializer = PurchaseSerializer(
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



#Platforms


@api_view(["GET"])
def get_platform(request):
    platform_obj = Platforms.objects.all()
    data_serializer = PlatformSerializer(platform_obj, many=True)
    return Response(data_serializer.data)



@api_view(["POST"])
def add_platform(request):
    platform_data = request.data
    data_serializer = PlatformSerializer(data = platform_data)
    if not data_serializer.is_valid():
        return Response({"error":data_serializer.errors})
            
    data_serializer.save()
        

    return Response(data_serializer.is_valid())



@api_view(["DELETE"])
def delete_platform(request, platform_id):
    try:
        product = Platforms.objects.get(id=platform_id)
    except Platforms.DoesNotExist:
        return Response({"error":"Purchase not found"}, status = 404)

  

    product.delete()

    return Response({"Result": "This platform has been deleted"})



@api_view(["PUT"])
def update_platform(request, platform_id):
    
    try:
        product = Platforms.objects.get(id=platform_id)
    except Platforms.DoesNotExist:
        return Response({"error": "platform not found"}, status=404)

    data_serializer = PlatformSerializer(
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



#Suppliers


@api_view(["GET"])
def get_supplier(request):
    supplier_obj = Suppliers.objects.all()
    data_serializer = SuppliersSerializer(supplier_obj, many=True)
    return Response(data_serializer.data)



@api_view(["POST"])
def add_supplier(request):
    supplier_data = request.data
    data_serializer = SuppliersSerializer(data = supplier_data)
    if not data_serializer.is_valid():
        return Response({"error":data_serializer.errors})
            
    data_serializer.save()
        

    return Response(data_serializer.is_valid())



@api_view(["DELETE"])
def delete_supplier(request, supplier_id):
    try:
        product = Suppliers.objects.get(id=supplier_id)
    except Suppliers.DoesNotExist:
        return Response({"error":"supplier not found"}, status = 404)

  

    product.delete()

    return Response({"Result": "This supplier has been deleted"})



@api_view(["PUT"])
def update_supplier(request, supplier_id):
    
    try:
        product = Suppliers.objects.get(id=supplier_id)
    except Suppliers.DoesNotExist:
        return Response({"error": "supplier not found"}, status=404)

    data_serializer = SuppliersSerializer(
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



#Product Category


@api_view(["GET"])
def get_category(request):
    category_obj = ProductCategory.objects.all()
    data_serializer = ProductCategorySerializer(category_obj, many=True)
    return Response(data_serializer.data)



@api_view(["POST"])
def add_category(request):
    category_data = request.data
    data_serializer = ProductCategorySerializer(data = category_data)
    if not data_serializer.is_valid():
        return Response({"error":data_serializer.errors})
            
    data_serializer.save()
        

    return Response(data_serializer.is_valid())



@api_view(["DELETE"])
def delete_category(request, category_id):
    try:
        product = ProductCategory.objects.get(id=category_id)
    except ProductCategory.DoesNotExist:
        return Response({"error":"category not found"}, status = 404)

  

    product.delete()

    return Response({"Result": "This category has been deleted"})



@api_view(["PUT"])
def update_category(request, category_id):
    
    try:
        product = ProductCategory.objects.get(id=category_id)
    except ProductCategory.DoesNotExist:
        return Response({"error": "category not found"}, status=404)

    data_serializer = ProductCategorySerializer(
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