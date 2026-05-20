from django.db import models
from django.contrib.auth.models import AbstractUser
# Create your models here.
class User(AbstractUser):
    username = models.CharField(
        max_length= 150,
        blank= True,
        null= True
    )
    
    email = models.EmailField(
        unique= True
    )
    
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []
    
class Friendship(models.Model):
    status = models.CharField( max_length=50, default = "pending")
    from_user = models.ForeignKey(User, on_delete= models.CASCADE, related_name= 'sent_friendships')
    to_user = models.ForeignKey(User, on_delete= models.CASCADE, related_name= 'received_friendships')
    created_at = models.DateTimeField(auto_now_add= True)  
    
    class Meta:
        unique_together = ('from_user', 'to_user')