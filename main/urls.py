from django.urls import include, path
from rest_framework import routers
from .views import image
from .rest import views


app_name = "main"
urlpatterns = [
    path("img/<int:pk>/download", image.ImageDownloadView.as_view(), name="img_download"),

    path("api/roots", views.RootListView.as_view(), name="root-list"),
    path("api/dir/<int:pk>/detail", views.DirectoryDetailView.as_view(), name="directory-detail"),
    path("api/dir/<int:pk>/crumbs", views.DirectoryCrumbsView.as_view(), name="directory-crumbs"),
    path("api/dir/<int:pk>/actions", views.DirectoryActionsView.as_view(), name="directory-actions"),
    path("api/dir/<int:pk>/tracks", views.DirectoryTracksView.as_view(), name="directory-track"),

    path("api/imgset/actions", views.ImageSetActionsView.as_view(), name="image-set-actions"),

    path("api/img/<int:pk>/metadata", views.ImageMetadataView.as_view(), name="image-metadata"),

    path("api/author", views.AuthorListView.as_view(), name="author-list"),
    path("api/author/<int:pk>/detail", views.AuthorDetailView.as_view(), name="author-detail"),
    
    path("api/attachment/<int:pk>/detail", views.AttachmentDetailView.as_view(), name="attachment-detail"),
]
