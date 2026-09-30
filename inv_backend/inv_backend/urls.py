from django.contrib import admin
from django.urls import path,include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('product/', include("manage_products.urls")),
    path('user/', include("manage_user.urls")),
    path('purchase/', include("manage_products.urls")),
    path('sales/', include("manage_products.urls"))
]
