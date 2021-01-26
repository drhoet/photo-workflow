from django.contrib import admin
from .models import Author, Directory, Image

admin.site.register(Directory)
admin.site.register(Image)
admin.site.register(Author)
