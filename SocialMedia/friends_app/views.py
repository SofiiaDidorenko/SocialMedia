from django.shortcuts import render
from django.http import HttpRequest
from django.views.generic import TemplateView
# Create your views here.
class FriendsView(TemplateView):
    template_name = 'friends_app/friends.html'
class FriendRequestsView(TemplateView):
    template_name = 'friends_app/requests.html'
class FriendMainView(TemplateView):
    template_name = 'friends_app/friends_main.html'
class RecommendationsView(TemplateView):
    template_name = 'friends_app/recommendations.html'
class AllFriendsView(TemplateView):
    template_name = 'friends_app/all_friends.html'