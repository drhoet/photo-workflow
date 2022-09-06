import os
from rest_framework import serializers
from main.models import Directory, Image, Author, Attachment
from main.services import MetadataSerializerService

class AttachmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Attachment
        fields = ['id', 'name', 'attachment_type']


class AttachmentNestedSerializer(serializers.HyperlinkedModelSerializer):
    url = serializers.HyperlinkedIdentityField(view_name='main:attachment-detail')

    class Meta:
        model = Attachment
        fields = ['id', 'url', 'name', 'attachment_type']


class AuthorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Author
        fields = ['id', 'name']


class AuthorNestedSerializer(serializers.HyperlinkedModelSerializer):
    url = serializers.HyperlinkedIdentityField(view_name='main:author-detail')

    class Meta:
        model = Author
        fields = ['id', 'url', 'name']


class ImageNestedSerializer(serializers.HyperlinkedModelSerializer):
    url = serializers.HyperlinkedIdentityField(view_name='main:image-detail')
    author = AuthorNestedSerializer(read_only=True)
    attachments = AttachmentNestedSerializer(many=True)
    date_time = serializers.SerializerMethodField()
    coordinates = serializers.SerializerMethodField()
    supported_metadata_types = serializers.SerializerMethodField()

    class Meta:
        model = Image
        fields = ['id', 'url', 'name', 'author', 'date_time', 'coordinates', 'supported_metadata_types', 'errors', 'attachments', 'thumbnail']
    
    def get_date_time(self, obj):
        return obj.date_time.isoformat() if obj.date_time is not None else None
    
    def get_coordinates(self, obj):
        if obj.gps_longitude is not None and obj.gps_latitude is not None:
            return {
                "lon": obj.gps_longitude,
                "lat": obj.gps_latitude,
                "alt": obj.gps_altitude
            }
        else:
            return None
    
    def get_supported_metadata_types(self, obj):
        ext = os.path.splitext(obj.name)[1]
        return [x.name for x in MetadataSerializerService.instance().supported_metadata_types(ext)]


class DirectoryNestedSerializer(serializers.HyperlinkedModelSerializer):
    url = serializers.HyperlinkedIdentityField(view_name='main:directory-detail')

    class Meta:
        model = Directory
        fields = ['id', 'url', 'path']


class ImageSerializer(serializers.HyperlinkedModelSerializer):
    parent = DirectoryNestedSerializer(read_only=True)
    author = AuthorNestedSerializer(read_only=True)
    attachments = AttachmentNestedSerializer(many=True)
    date_time = serializers.SerializerMethodField()
    coordinates = serializers.SerializerMethodField()

    class Meta:
        model = Image
        fields = ['id', 'name', 'parent', 'author', 'attachments', 'date_time', 'coordinates', 'errors']
    
    def get_date_time(self, obj):
        return obj.date_time.isoformat() if obj.date_time is not None else None

    def get_coordinates(self, obj):
        if obj.gps_longitude is not None and obj.gps_latitude is not None:
            return {
                "lon": obj.gps_longitude,
                "lat": obj.gps_latitude,
                "alt": obj.gps_altitude
            }
        else:
            return None


class DirectorySerializer(serializers.HyperlinkedModelSerializer):
    parent = DirectoryNestedSerializer(read_only=True)
    images = ImageNestedSerializer(many=True)
    subdirs = DirectoryNestedSerializer(many=True)

    class Meta:
        model = Directory
        fields = ['id', 'parent', 'path', 'images', 'subdirs']


class CoordinateSerializer(serializers.Serializer):
    longitude = serializers.FloatField()
    latitude = serializers.FloatField()
    altitude = serializers.FloatField()


class GpsFixSerializer(serializers.Serializer):
    timestamp = serializers.DateTimeField()
    coordinate = CoordinateSerializer()


class GpsTrackSectionSerializer(serializers.Serializer):
    name = serializers.CharField()
    gps_fixes = GpsFixSerializer(many=True)


class GpsTrackSerializer(serializers.Serializer):
    name = serializers.CharField()
    sections = GpsTrackSectionSerializer(many=True)


class GpsTrackWithMetadataSerializer(serializers.Serializer):
    id = serializers.CharField()
    display_name = serializers.CharField()
    data = GpsTrackSerializer()