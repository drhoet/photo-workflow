# Generated by Django 3.1.5 on 2021-04-04 09:02

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('main', '0009_attachment'),
    ]

    operations = [
        migrations.AlterField(
            model_name='image',
            name='tz_offset_seconds',
            field=models.IntegerField(null=True),
        ),
    ]
