from django.shortcuts import render
from django.views import View

from main.models import Directory


class IndexView(View):
    def get(self, request):
        return render(
            request,
            "main/index.html",
            {
                "roots": Directory.objects.filter(parent__isnull=True),
            },
        )
