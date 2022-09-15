from django.contrib import admin
from .models import Author, Directory, Image, Attachment, Tag

admin.site.register(Directory)
admin.site.register(Image)
admin.site.register(Author)
admin.site.register(Attachment)
admin.site.register(Tag)
