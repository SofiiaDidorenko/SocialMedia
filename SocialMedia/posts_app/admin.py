from django.contrib import admin

# Register your models here.
from django.contrib import admin
from .models import Post, Tag, PostImage, PostLink

@admin.register(Tag)
class TagAdmin(admin.ModelAdmin):
    list_display = ('name',)

@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    list_display = ('title', 'author', 'created_at')
    filter_horizontal = ('tags',) 

admin.site.register(PostImage)
admin.site.register(PostLink)
