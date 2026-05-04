from django.db import models

# Create your models here.

class Post(models.Model):
    title = models.CharField(max_length=250)
    topic = models.CharField(max_length=250, blank= True, null=True)
    content= models.CharField(max_length=250)
    created_at= models.DateField(auto_now_add=True)
    updated_at= models.DateField(auto_now=True)
    author= models.ForeignKey(to= 'User', on_delete= models.CASCADE, related_name = 'user')
    tags= models.ManyToManyField(to= 'Tag', related_name = 'tags')
    
class Tag(models.Model):
    name = models.CharField(max_length=100)

class PostImage(models.Model):
    original_image = models.ImageField(upload_to="post_photos/original")
    compressed_image = models.ImageField(upload_to="post_photos/compressed")
    post = models.ForeignKey(to = 'Post', on_delete = models.CASCADE, related_name = 'images')

class PostLike(models.Model):
    user = models.ForeignKey(to= 'User', on_delete = models.CASCADE, related_name = 'likes')
    post = models.ForeignKey(to= 'Post', on_delete = models.CASCADE, related_name = 'likes')
    
class PostHeart(models.Model):
    user = models.ForeignKey(to= 'User', on_delete = models.CASCADE, related_name = 'hearts')
    post = models.ForeignKey(to= 'Post', on_delete = models.CASCADE, related_name = 'hearts')
    
class PostView(models.Model):
    user = models.ForeignKey(to= 'User', on_delete = models.CASCADE, related_name = 'views')
    post = models.ForeignKey(to= 'Post', on_delete = models.CASCADE, related_name = 'views')
    
class PostLink(models.Model):
    url = models.CharField(max_length=250)
    post = models.ForeignKey(to = 'Post', on_delete= models.CASCADE, related_name = 'urls')
    