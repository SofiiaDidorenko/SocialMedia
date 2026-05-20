import json

from django.shortcuts import render, get_object_or_404
from django.views.generic import TemplateView
from django.http import JsonResponse
from django.core.paginator import Paginator
from django.contrib.auth.models import User
from django.contrib.auth.decorators import login_required
from django.views.decorators.http import require_POST
from django.contrib.auth.mixins import LoginRequiredMixin
from .models import Post, Tag
from .forms import PostForm

class PostsView(LoginRequiredMixin, TemplateView):
    template_name = 'post_app/post.html'
    paginate_by = 3

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        
        queryset = Post.objects.all().prefetch_related('images', 'tags', 'urls').order_by('-created_at')
        paginator = Paginator(queryset, self.paginate_by)
        
        page_number = self.request.GET.get('page', 1)
        page_obj = paginator.get_page(page_number)
        
        context['posts'] = page_obj.object_list
        context['tags'] = Tag.objects.all()
        context['form'] = PostForm()
        return context

    def post(self, request, *args, **kwargs):
        form = PostForm(request.POST)
        if form.is_valid():
            images = request.FILES.getlist('image')
            links = request.POST.getlist('links')
            
            author = request.user if request.user.is_authenticated else User.objects.first()
            
            form.save(author=author, images=images, links=links)
            return JsonResponse({'status': 'success'})
        else:
            return JsonResponse({'status': 'error', 'errors': form.errors}, status=400)


def add_tag_ajax(request):
    if request.method == 'POST':
        data = json.loads(request.body)
        name = data.get('name', '').strip()
        if name:
            tag, _ = Tag.objects.get_or_create(name=name)
        return JsonResponse({'id': tag.id, 'name': tag.name})
    return JsonResponse({'error': 'fail'}, status=400)


@login_required
@require_POST
def delete_post_ajax(request, pk):

    post = get_object_or_404(Post, id=pk)
    post.delete()
    return JsonResponse({'success': True})
