import sys, logging

from rest_framework import viewsets, generics, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from django.http import Http404
from django.shortcuts import get_object_or_404

from main.models import Directory, Image, Attachment, Author, ImageSetService
from main.rest.serializers import DirectorySerializer, ImageSerializer, AuthorSerializer, AttachmentSerializer, DirectoryNestedSerializer

class AuthorListView(generics.ListAPIView):
    queryset = Author.objects.all()
    serializer_class = AuthorSerializer
    permission_classes = [permissions.AllowAny]


class AuthorDetailView(generics.RetrieveAPIView):
    queryset = Author.objects.all()
    serializer_class = AuthorSerializer
    permission_classes = [permissions.AllowAny]


class AttachmentDetailView(generics.RetrieveAPIView): 
    queryset = Attachment.objects.all()
    serializer_class = AttachmentSerializer
    permission_classes = [permissions.AllowAny]


class RootListView(generics.ListAPIView):
    queryset = Directory.objects.filter(parent = None)
    serializer_class = DirectoryNestedSerializer
    permission_classes = [permissions.AllowAny]


class DirectoryDetailView(generics.RetrieveAPIView):
    queryset = Directory.objects.all()
    serializer_class = DirectorySerializer
    permission_classes = [permissions.AllowAny]


class ImageDetailView(generics.RetrieveAPIView):
    queryset = Image.objects.all()
    serializer_class = ImageSerializer
    permission_classes = [permissions.AllowAny]


class ImageMetadataView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, *args, **kwargs):
        image = get_object_or_404(Image, pk=kwargs.get("pk"))
        return Response(image.read_exif_json_from_file())


class DirectoryCrumbsView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, *args, **kwargs):
        directory = get_object_or_404(Directory, pk=kwargs.get("pk"))
        breadcrumbs = [directory]
        cursor = directory.parent
        while cursor:
            breadcrumbs.insert(0, cursor)
            cursor = cursor.parent
        serializer = DirectoryNestedSerializer(breadcrumbs, many=True, context={'request': request})
        return Response(serializer.data)


class DirectoryActionsView(APIView):
    permission_classes = [permissions.AllowAny]
    logger = logging.getLogger(__name__)

    def post(self, request, *args, **kwargs):
        try:
            directory = get_object_or_404(Directory, pk=kwargs.get("pk"))
            action = request.POST["action"]
            if action == "scan":
                reload = request.POST["reload"]
                directory.scan(reload == 'true')
            elif action == "organize_into_directories":
                directory.organize_into_directories()
                directory.scan(False)
            # elif action == "complete_timestamps":
            #     return HttpResponseRedirect(reverse("main:complete_timestamps", args=(pk,)))
            # elif action == "geotag":
            #     pass
            elif action == "write_metadata":
                 directory.write_images_metadata()
            elif action == "remove_dir_from_db":
                parent_id = directory.parent.id
                directory.remove_from_db()
            else:
                return Response({'message': "Unsupported action"}, 400)

            return Response({'result': 'OK'}, 200)
        except Http404:
            return Response({'message': "Not found"}, 404)
        except Exception as exc:
            self.logger.error(exc, exc_info=True)
            return Response({'message': "Unknown exception: " + getattr(exc, 'message', repr(exc))}, 500)


class ImageSetActionsView(APIView):
    permission_classes = [permissions.AllowAny]
    logger = logging.getLogger(__name__)

    def post(self, request, *args, **kwargs):
        try:
            action = request.POST["action"]
            if not request.POST["ids"]:
                self.logger.info('No ids specified to do the action on. Just skipping...')
                return Response({'result': 'OK'}, 200)
            ids = request.POST["ids"].split(",")

            images = Image.objects.filter(pk__in = ids)

            if action == "edit_timezone":
                mode = request.POST["mode"]
                value = int(request.POST["value"])
                if mode == "overwrite":
                    ImageSetService.instance().overwrite_timezone(ids, value)
                elif mode == "translate":
                    ImageSetService.instance().translate_timezone(ids, value)
                else:
                    raise ValueError(f'Invalid mode: {mode}')
            elif action == "set_author":
                author = get_object_or_404(Author, pk=request.POST["author"])
                ImageSetService.instance().set_author(ids, author)
            else:
                return Response({'message': "Unsupported action"}, 400)

            return Response({'result': 'OK'}, 200)
        except Exception as exc:
            self.logger.error(exc, exc_info=True)
            return Response({'message': "Unknown exception: " + getattr(exc, 'message', repr(exc))}, 500)