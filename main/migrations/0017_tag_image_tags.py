# Generated by Django 4.1 on 2022-09-10 04:41

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('main', '0016_image_color_label_image_pick_label'),
    ]

    operations = [
        migrations.CreateModel(
            name='Tag',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=255)),
                ('parent', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='subtags', to='main.tag')),
            ],
        ),
        migrations.AddField(
            model_name='image',
            name='tags',
            field=models.ManyToManyField(related_name='tags', to='main.tag'),
        ),
    ]
