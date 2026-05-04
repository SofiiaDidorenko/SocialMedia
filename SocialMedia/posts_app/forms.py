from io import BytesIO
from PIL import Image
from django import forms
from .models import *
from django.core.files.base import ContentFile
MAX_COMPRESSED_IMAGE_SIZE = 5 * 1024 * 1024   #5MB

class MultipleFileInput(forms.ClearableFileInput):
    allow_multiple_selected = True

class MultipleFileField(forms.FileField):
    def clean(self, data, initial=None):
        single_file_clean = super().clean
        if isinstance(data, (list, tuple)):
            clean_files = []
            for file in data:
                clean_files.append(single_file_clean(file, initial))
            return clean_files
        return single_file_clean(data, initial)
        

class PostForm(forms.ModelForm):
    tags = forms.ModelMultipleChoiceField( 
        required=False,
        queryset= Tag.objects.all(),
        widget=forms.CheckboxSelectMultiple
    )
    image = MultipleFileField(required = False, widget = MultipleFileInput(
        attrs={
            'multiple' : True,
            'accept' : 'image/*'
        }
    ))

    class Meta:
        model = Post
        fields = ['title', 'topic', 'content']
        widgets = {
            'title' : forms.TextInput(attrs= {'placeholder' : 'title'}),
            'topic' : forms.TextInput(attrs= {'placeholder' : 'topic'}),
            'content' : forms.Textarea(attrs= {"rows": 5,'placeholder' : 'title'})
        }
    def __init__(self, links=None, images=None, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['tags'].queryset = Tag.objects.all()
        self.links_list = []
        self.image_list = []
        if links is None:
            links = []
        for link in links:
            clean_link = link.strip()
            if clean_link:
                self.links_list.append(clean_link)
        if images is not None:
            self.image_list = list(images)
    def clean(self):
        clean_data = super().clean()
        
        url_field = forms.URLField()
        image_field = forms.ImageField()
        for link in self.links_list:
            try:
                url_field.clean(link)
            except: 
                self.add_error("links", "Некоректне посилання")
        for image in self.image_list:
            try:
                image_field.clean(image)
            except: 
                self.add_error("images", "Некоректне зображення")
        return clean_data
    def save(self, author, commmit=True):
        post = super().save(commit=False)
        post.author = author 
        if commmit:
            post.save()
            post.tags.set(self.cleaned_data["tags"])
            for link in self.links_list:
                PostLink.objects.create(post=post, url=link)
            for image in self.image_list:
                PostImage.objects.all(
                    post=post,
                    original_image=image, 
                    compressed_image=self.compress_image(image)
                )

        return post
    
    def compress_image(self, image):
        image.seek(0) 
        pil_image = Image.open(image)
        pil_image = pil_image.convert("RGB")
        quality = 85
        width, height = pil_image.size
        while True:
                buffer = BytesIO()
                pil_image.save(buffer, format="JPEG", quality=quality, optimize=True)
                if buffer.tell() <= MAX_COMPRESSED_IMAGE_SIZE:
                    break 
                if quality > 35:
                    quality -= 10
                else: 
                    if width <= 1 or height <= 1:
                        break
                    width = int(width * 0.9)
                    height = int(height * 0.9)
                    pil_image.resize((width, height), Image.Resampling.LANCZOS)
        image.seek(0)
        compressed_name = f"compressed_{image.name.rsplit('.', 1)[0]}.jpg"
        return ContentFile(buffer.getvalue(), name=compressed_name)

           

