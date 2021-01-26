from django.http import HttpResponseRedirect, HttpResponseServerError
from django.urls import reverse
from django.shortcuts import get_object_or_404
from django.views.generic import ListView

from main.models import Author, Directory


class SelectAuthorView(ListView):
    model = Author
    template_name = "main/select_author.html"

    def post(self, request, *args, **kwargs):
        if "dir_id" in kwargs:
            dir = get_object_or_404(Directory, pk=kwargs.get("dir_id"))
            author = get_object_or_404(Author, pk=request.POST["author"])
            dir.set_author(author)
            return HttpResponseRedirect(reverse("main:browse", args=(kwargs.get("dir_id"),)))
        else:
            return HttpResponseServerError()
