from django.db import models
from django.conf import settings

# Create your models here.

class Post(models.Model):
    title = models.CharField(max_length=250)
    topic = models.CharField(max_length=250, blank=True, null=True)
    content = models.TextField()  
    created_at = models.DateField(auto_now_add=True)
    updated_at = models.DateField(auto_now=True)
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE, 
        related_name='posts'
    )
    tags = models.ManyToManyField(to='Tag', related_name='posts')

    class Meta:
        db_table = "post_app_post"
    
    def __str__(self):
        return self.title
    
class Tag(models.Model):
    name = models.CharField(max_length=100)

    def __str__(self):
        return self.name
    class Meta:
        db_table = "post_app_tag"

class PostImage(models.Model):
    original_image = models.ImageField(upload_to="post_photos/original")
    compressed_image = models.ImageField(upload_to="post_photos/compressed")
    post = models.ForeignKey(
        to='Post', 
        on_delete=models.CASCADE, 
        related_name='images'
    )
    class Meta:
        db_table = "post_app_postimage"

class PostLike(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE, 
        related_name='post_likes'
    )
    post = models.ForeignKey(
        to='Post', 
        on_delete=models.CASCADE, 
        related_name='post_likes'
    )
    class Meta:
        db_table = "post_app_postlike"

class PostHeart(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE, 
        related_name='hearts'
    )
    post = models.ForeignKey(
        to='Post', 
        on_delete=models.CASCADE, 
        related_name='hearts'
    )
    class Meta:
        db_table = "post_app_postheart"

class PostView(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE, 
        related_name='post_views'
    )
    post = models.ForeignKey(
        to='Post', 
        on_delete=models.CASCADE, 
        related_name='post_views'
    )
    class Meta:
        db_table = "post_app_postview"
        
class PostLink(models.Model):
    url = models.CharField(max_length=250)
    post = models.ForeignKey(
        to='Post', 
        on_delete=models.CASCADE, 
        related_name='urls'
    )
    class Meta:
        db_table = "post_app_postlink"

