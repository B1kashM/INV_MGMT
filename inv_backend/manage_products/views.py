from django.shortcuts import render

from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.authtoken.models import Token
from django.contrib.auth import authenticate
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from .serializers import *
from rest_framework import status
from .models import *
from django.db.models import Sum
from django.db import IntegrityError, transaction
from rest_framework import serializers, status
from .models import ProductCategory, ProductDetails
from decimal import Decimal
from django.utils import timezone
from django.utils.dateparse import parse_date, parse_datetime


from .models import Platforms, ProductDetails, Sales

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
    product_obj  = ProductDetails.objects.get(id=sales_data["product_id"])
    if product_obj.stock_quantity<sales_data["quantity"]:
        return Response({"error":"Stocks not available"},status=400)
    selling_price = float(sales_data["selling_price"])

    sales_data["total_amount"] = quantity*selling_price
    data_serializer = SalesSerializer(data = sales_data)
    if not data_serializer.is_valid():
        return Response({"error":data_serializer.errors})
            
    data_serializer.save()
    product_obj.stock_quantity-=sales_data["quantity"]
    product_obj.save()

        

    return Response(data_serializer.is_valid())





@api_view(["DELETE"])
def delete_sales(request, sales_id):
    try:
        with transaction.atomic():
            try:
                sale = Sales.objects.select_for_update().get(
                    id=sales_id
                )
            except Sales.DoesNotExist:
                return Response(
                    {"error": "Sales not found"},
                    status=404,
                )

            # Get the associated product and lock its row.
            try:
                product = ProductDetails.objects.select_for_update().get(
                    id=sale.product_id_id
                )
            except ProductDetails.DoesNotExist:
                return Response(
                    {"error": "Associated product not found"},
                    status=404,
                )

            # Restore the quantity sold.
            product.stock_quantity += sale.quantity
            product.save(update_fields=["stock_quantity"])

            # Delete the sale.
            sale.delete()

        return Response(
            {
                "Result": "This Sale has been deleted",
                "restored_quantity": sale.quantity,
                "updated_stock": product.stock_quantity,
            },
            status=200,
        )

    except Exception:
        return Response(
            {"error": "Failed to delete sale"},
            status=500,
        )




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
    purchase_obj = PurchaseLogs.objects.all()
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
    purchase_price = float(purchase_data["purchase_price"])
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


@api_view(["GET"])
def get_summary(request):
    summary_obj = Sales.objects.aggregate(sale_quantity = Sum("quantity"))
    returns_obj = Returns.objects.aggregate(return_quantity = Sum("quantity"))
    data = summary_obj | returns_obj
    return Response({"data":data})


@api_view(["PUT"])
def return_sales(request, product_id):

    
    try:
        return_product = int(request.data.get("number"))
        product = Sales.objects.get(id=product_id)
        Product_detail = ProductDetails.objects.get(id=product.product_id.id)
        product.quantity -= return_product
        Product_detail.stock_quantity += return_product
        product.save()
        Product_detail.save()
        Returns.objects.create(sales_id = product, quantity = return_product)
        return Response({"Success": "Items marked as Return"}) 
    except Sales.DoesNotExist:
        return Response({"error": "product not found"}, status=404)


@api_view(["POST"])
def purchase_product(request):
    data = request.data
    product_id = data["product_id"]
    product_obj = ProductDetails.objects.get(id = product_id)
    product_obj.stock_quantity += data["quantity"]
    log_seri = PurchaseLogsSerializer(data = data)
    if not log_seri.is_valid():
        return Response({"error": log_seri.errors})
    product_obj.save()
    log_seri.save()
    return Response({"msg":"Log has been successfully created"})


#Login page API

@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def login_user(request):
    user = authenticate(
        username=request.data.get("username"),
        password=request.data.get("password"),
    )
    if user is None:
        return Response({"error": "Invalid username or password."}, status=401)

    token, _ = Token.objects.get_or_create(user=user)
    return Response({"token": token.key, "username": user.username})


@api_view(["POST"])
# @authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def logout_user(request):
    request.user.auth_token.delete()
    return Response({"message": "Logged out."})


@api_view(["GET"])
def get_returns(request):
    returns_obj = Returns.objects.all()
    data_serializer = ReturnsSerializer(returns_obj, many=True)
    return Response(data_serializer.data)


MAX_ROWS = 2000       # keep in sync with MAX_ROWS in BulkUploadModal.tsx
MAX_INT = 2147483647  # PositiveIntegerField limit



def _flatten(errs):
    return "; ".join(
        f"{field}: {' '.join(str(m) for m in (msgs if isinstance(msgs, list) else [msgs]))}"
        for field, msgs in errs.items()
    )


@api_view(["POST"])
def bulk_add_product(request):
    rows = request.data
    if not isinstance(rows, list) or not rows:
        return Response(
            {"message": "Send a non-empty JSON array of products."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if len(rows) > MAX_ROWS:
        return Response(
            {"message": f"Too many rows ({len(rows)}). The limit is {MAX_ROWS} per upload."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    skip_invalid = request.query_params.get("skip_invalid", "").lower() in ("true", "1", "yes")

    errors = []   # [{"row": <1-based position in the array>, "message": "..."}]
    cleaned = []  # [(row_number, validated_data)]

    # 1) Field-level validation (no DB access)
    for n, raw in enumerate(rows, start=1):
        s = BulkProductRowSerializer(data=raw)
        if s.is_valid():
            row_data = s.validated_data

            # A serializer field backed by a ForeignKey may return a
            # ProductCategory instance instead of its numeric primary key.
            # Normalize it to an ID because the bulk-upload logic below
            # performs ID lookups and assigns the raw FK column.
            category_value = row_data.get("category_id")
            if isinstance(category_value, ProductCategory):
                row_data["category_id"] = category_value.pk

            cleaned.append((n, row_data))
        else:
            errors.append({"row": n, "message": _flatten(s.errors)})

    # 2) Two queries for the whole batch, instead of two per row
    existing_ids = set(
        ProductDetails.objects
        .filter(product_id__in=[d["product_id"] for _, d in cleaned])
        .values_list("product_id", flat=True)
    )
    valid_category_ids = set(
        ProductCategory.objects
        .filter(pk__in={d["category_id"] for _, d in cleaned})
        .values_list("pk", flat=True)
    )

    valid = []
    seen = {}  # product_id -> first valid row that used it
    for n, d in cleaned:
        pid = d["product_id"]
        if pid in existing_ids:
            errors.append({"row": n, "message": f"product_id {pid} already exists"})
        elif pid in seen:
            errors.append({"row": n, "message": f"product_id {pid} is repeated (see row {seen[pid]})"})
        elif d["category_id"] not in valid_category_ids:
            errors.append({"row": n, "message": f"category {d['category_id']} doesn't exist"})
        else:
            seen[pid] = n
            valid.append((n, d))

    errors.sort(key=lambda e: e["row"])

    # 3) Reject the whole request, or skip bad rows, depending on the flag
    if errors and not skip_invalid:
        return Response(
            {
                "message": f"{len(errors)} row(s) have problems. Nothing was saved.",
                "errors": errors,
            },
            status=status.HTTP_400_BAD_REQUEST,
        )
    if not valid:
        return Response(
            {"message": "No valid rows to insert.", "errors": errors},
            status=status.HTTP_400_BAD_REQUEST,
        )

    objs = [
        ProductDetails(
            product_id=d["product_id"],
            product_name=d["product_name"],
            brand_name=d["brand_name"],
            category_id_id=d["category_id"],  # FK column, avoids fetching the category
            sku=d["sku"],
            size=d["size"],
            color=d["color"],
            purchase_price=d["purchase_price"],
            selling_price=d["selling_price"],
            stock_quantity=d["stock_quantity"],
            reorder_level=d.get("reorder_level"),
            status=d["status"],
        )
        for _, d in valid
    ]

    # 4) One transaction, a few INSERT statements instead of one per row
    try:
        with transaction.atomic():
            ProductDetails.objects.bulk_create(objs, batch_size=500)
    except IntegrityError as e:
        # e.g. another request inserted the same product_id between our check and the insert
        return Response(
            {"message": f"Database rejected the upload, nothing was saved: {e}"},
            status=status.HTTP_409_CONFLICT,
        )

    return Response(
        {"created": len(objs), "skipped": len(errors), "errors": errors},
        status=status.HTTP_201_CREATED,
    )

#sales bulk add



MAX_ROWS = 2000       # keep in sync with the frontend
MAX_INT = 2147483647

PRODUCT_LOOKUP_FIELD = "product_id"


def _flatten(errs):
    return "; ".join(
        f"{field}: {' '.join(str(m) for m in (msgs if isinstance(msgs, list) else [msgs]))}"
        for field, msgs in errs.items()
    )


def _parse_sell_date(value):
    """Accepts '2026-10-16' or '2026-10-16T14:30:00'. Blank returns now. Invalid returns None."""
    if value in (None, ""):
        return timezone.now()
    value = str(value).strip()
    dt = parse_datetime(value)
    if dt is None:
        d = parse_date(value)
        if d is None:
            return None
        dt = timezone.datetime(d.year, d.month, d.day)
    if timezone.is_naive(dt):
        dt = timezone.make_aware(dt)
    return dt




from datetime import datetime, date, time
from decimal import Decimal

from django.db import transaction, IntegrityError
from django.utils import timezone

from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status


def _parse_sell_date(value):
    """
    Convert uploaded date values into Python datetime objects.
    Supports ISO dates, Excel-style date strings, and timestamps.
    Does not substitute today's date when the value is invalid.
    """
    if value is None or str(value).strip() == "":
        return None

    if isinstance(value, datetime):
        parsed = value

    elif isinstance(value, date):
        parsed = datetime.combine(value, time.min)

    else:
        value = str(value).strip()
        parsed = None

        formats = [
            "%Y-%m-%d",
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%dT%H:%M:%S.%f",
            "%Y-%m-%d %H:%M:%S",
            "%d-%m-%Y",
            "%d/%m/%Y",
            "%m/%d/%Y",
            "%d-%m-%Y %H:%M:%S",
            "%d/%m/%Y %H:%M:%S",
        ]

        for fmt in formats:
            try:
                parsed = datetime.strptime(value, fmt)
                break
            except ValueError:
                continue

        # Support ISO timestamps with timezone offsets.
        if parsed is None:
            try:
                parsed = datetime.fromisoformat(
                    value.replace("Z", "+00:00")
                )
            except ValueError:
                return None

    # A date-only value becomes midnight on that date.
    # Make the datetime timezone-aware if Django uses timezone support.
    if timezone.is_naive(parsed) and timezone.is_aware(
        timezone.now()
    ):
        parsed = timezone.make_aware(
            parsed,
            timezone.get_current_timezone(),
        )

    return parsed


@api_view(["POST"])
def bulk_add_sales(request):
    rows = request.data

    if not isinstance(rows, list) or not rows:
        return Response(
            {"message": "Send a non-empty JSON array of sales."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if len(rows) > MAX_ROWS:
        return Response(
            {
                "message": (
                    f"Too many rows ({len(rows)}). "
                    f"The limit is {MAX_ROWS} per upload."
                )
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    skip_invalid = request.query_params.get(
        "skip_invalid", ""
    ).lower() in ("true", "1", "yes")

    errors = []
    cleaned = []

    # 1. Validate each row and parse the uploaded sale date.
    for n, raw in enumerate(rows, start=1):
        serializer = BulkSalesRowSerializer(data=raw)

        if not serializer.is_valid():
            errors.append({
                "row": n,
                "message": _flatten(serializer.errors),
            })
            continue

        # Use validated data for normalized serializer fields.
        d = serializer.validated_data.copy()

        # Preserve the original date key and parse its actual value.
        raw_date = raw.get("sell_date")

        # Also accept Sell_date if the frontend uses that key.
        if raw_date is None:
            raw_date = raw.get("Sell_date")

        sell_date = _parse_sell_date(raw_date)

        if sell_date is None:
            errors.append({
                "row": n,
                "message": (
                    "Invalid or missing sale date. Use "
                    "YYYY-MM-DD, DD-MM-YYYY, DD/MM/YYYY, "
                    "or an ISO timestamp."
                ),
            })
            continue

        cleaned.append((n, d, sell_date))

    # 2. Batch lookups for platforms and products.
    platform_ids_to_check = {
        d["platform_id"] for _, d, _ in cleaned
    }

    product_refs_to_check = {
        d["product_id"] for _, d, _ in cleaned
    }

    platform_ids = set(
        Platforms.objects.filter(
            pk__in=platform_ids_to_check
        ).values_list("pk", flat=True)
    )

    # Map uploaded product references to database primary keys.
    product_map = dict(
        ProductDetails.objects.filter(
            **{
                f"{PRODUCT_LOOKUP_FIELD}__in": product_refs_to_check
            }
        ).values_list(PRODUCT_LOOKUP_FIELD, "pk")
    )

    order_ids = {
        d["order_id"] for _, d, _ in cleaned
    }

    existing_keys = set(
        Sales.objects.filter(
            order_id__in=order_ids
        ).values_list(
            "platform_id_id",
            "order_id",
            "product_id_id",
        )
    )

    # 3. Validate references and duplicate sales.
    valid = []
    seen = {}

    for n, d, sell_date in cleaned:
        product_pk = product_map.get(d["product_id"])
        key = (d["platform_id"], d["order_id"], product_pk)

        if d["platform_id"] not in platform_ids:
            errors.append({
                "row": n,
                "message": (
                    f"Platform {d['platform_id']} doesn't exist."
                ),
            })

        elif product_pk is None:
            errors.append({
                "row": n,
                "message": (
                    f"Product {d['product_id']} doesn't exist."
                ),
            })

        elif key in existing_keys:
            errors.append({
                "row": n,
                "message": (
                    f"Order {d['order_id']} already has "
                    "this product recorded."
                ),
            })

        elif key in seen:
            errors.append({
                "row": n,
                "message": (
                    f"Order {d['order_id']} + product repeated "
                    f"(see row {seen[key]})."
                ),
            })

        else:
            seen[key] = n

            total = d.get("total_amount")

            if total is None:
                total = (
                    Decimal(str(d["quantity"]))
                    * Decimal(str(d["selling_price"]))
                ).quantize(Decimal("0.01"))

            valid.append(
                (n, d, product_pk, total, sell_date)
            )

    errors.sort(key=lambda e: e["row"])

    # 4. Reject existing validation errors unless skip_invalid is enabled.
    if errors and not skip_invalid:
        return Response(
            {
                "message": (
                    f"{len(errors)} row(s) have problems. "
                    "Nothing was saved."
                ),
                "errors": errors,
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    if not valid:
        return Response(
            {
                "message": "No valid rows to insert.",
                "errors": errors,
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    # 5. Check stock, insert sales, and update inventory atomically.
    try:
        with transaction.atomic():
            product_pks = {
                product_pk
                for _, _, product_pk, _, _ in valid
            }

            locked_products = {
                product.pk: product
                for product in (
                    ProductDetails.objects
                    .select_for_update()
                    .filter(pk__in=product_pks)
                    .order_by("pk")
                )
            }

            remaining_stock = {
                pk: product.stock_quantity
                for pk, product in locked_products.items()
            }

            stock_valid = []

            # Validate cumulative quantities for repeated products.
            for n, d, product_pk, total, sell_date in valid:
                if product_pk not in locked_products:
                    errors.append({
                        "row": n,
                        "message": "Product no longer exists.",
                    })
                    continue

                quantity = d["quantity"]
                available = remaining_stock[product_pk]

                if quantity > available:
                    errors.append({
                        "row": n,
                        "message": (
                            f"Insufficient stock for product "
                            f"{d['product_id']}. Available stock: "
                            f"{available}, requested: {quantity}."
                        ),
                    })
                    continue

                remaining_stock[product_pk] -= quantity

                stock_valid.append(
                    (n, d, product_pk, total, sell_date)
                )

            errors.sort(key=lambda e: e["row"])

            if errors and not skip_invalid:
                return Response(
                    {
                        "message": (
                            f"{len(errors)} row(s) have problems. "
                            "Nothing was saved."
                        ),
                        "errors": errors,
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if not stock_valid:
                return Response(
                    {
                        "message": "No valid rows to insert.",
                        "errors": errors,
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Create sales using the exact parsed date from each row.
            sales_objects = [
                Sales(
                    platform_id_id=d["platform_id"],
                    product_id_id=product_pk,
                    order_id=d["order_id"],
                    quantity=d["quantity"],
                    selling_price=d["selling_price"],
                    total_amount=total,
                    Sell_date=sell_date,
                    status=d["status"],
                )
                for _, d, product_pk, total, sell_date
                in stock_valid
            ]

            Sales.objects.bulk_create(
                sales_objects,
                batch_size=500,
            )

            # Deduct stock once per product.
            for pk, product in locked_products.items():
                new_stock = remaining_stock[pk]

                if new_stock != product.stock_quantity:
                    product.stock_quantity = new_stock
                    product.save(
                        update_fields=["stock_quantity"]
                    )

    except IntegrityError:
        return Response(
            {
                "message": (
                    "Database rejected the upload. "
                    "Nothing was saved."
                )
            },
            status=status.HTTP_409_CONFLICT,
        )

    # 6. Return the upload summary.
    return Response(
        {
            "created": len(stock_valid),
            "skipped": len(errors),
            "errors": errors,
        },
        status=status.HTTP_201_CREATED,
    )
