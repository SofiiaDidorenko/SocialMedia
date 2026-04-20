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