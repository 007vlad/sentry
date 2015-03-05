"""
sentry.web.frontend.groups
~~~~~~~~~~~~~~~~~~~~~~~~~~

Contains views for the "Events" section of Sentry.

TODO: Move all events.py views into here, and rename this file to events.

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import, division

from django.core.urlresolvers import reverse
from django.http import (
    Http404, HttpResponse, HttpResponseRedirect
)
from django.shortcuts import get_object_or_404

from sentry.api.serializers import serialize
from sentry.auth import access
from sentry.constants import MEMBER_USER
from sentry.models import (
    Project, Group, GroupMeta, Event
)
from sentry.plugins import plugins
from sentry.utils import json
from sentry.web.decorators import has_access, login_required
from sentry.web.helpers import render_to_response


def render_with_group_context(group, template, context, request=None,
                              event=None, is_public=False):
    context.update({
        'team': group.project.team,
        'organization': group.project.organization,
        'project': group.project,
        'group': group,
        'selectedGroup': serialize(group, request.user),
    })

    if request:
        context['ACCESS'] = access.from_user(
            user=request.user,
            organization=group.organization,
        ).to_django_context()
    else:
        context['ACCESS'] = access.DEFAULT.to_django_context()

    if event:
        if event.id:
            # TODO(dcramer): we dont want to actually use gt/lt here as it should
            # be inclusive. However, that would need to ensure we have some kind
            # of way to know which event was the previous (an offset), or to add
            # a third sort key (which is not yet indexed)
            base_qs = group.event_set.exclude(id=event.id)
            try:
                next_event = base_qs.filter(
                    datetime__gt=event.datetime,
                ).order_by('datetime')[0:1].get()
            except Event.DoesNotExist:
                next_event = None

            try:
                prev_event = base_qs.filter(
                    datetime__lt=event.datetime,
                ).order_by('-datetime')[0:1].get()
            except Event.DoesNotExist:
                prev_event = None
        else:
            next_event = None
            prev_event = None

        if not is_public:
            extra_data = event.data.get('extra', {})
            if not isinstance(extra_data, dict):
                extra_data = {}

            context.update({
                'tags': event.get_tags(),
                'json_data': extra_data,
            })

        context.update({
            'event': event,
            'version_data': event.data.get('modules', None),
            'next_event': next_event,
            'prev_event': prev_event,
        })

    return render_to_response(template, context, request)


@login_required
def redirect_to_group(request, project_id, group_id):
    group = get_object_or_404(Group, id=group_id)

    return HttpResponseRedirect(reverse('sentry-group', kwargs={
        'project_id': group.project.slug,
        'organization_slug': group.project.organization.slug,
        'group_id': group.id,
    }))


@login_required
@has_access
def wall_display(request, organization, team):
    project_list = list(Project.objects.filter(team=team))

    for project in project_list:
        project.team = team

    return render_to_response('sentry/wall.html', {
        'team': team,
        'organization': team.organization,
        'project_list': project_list,
    }, request)


@has_access(MEMBER_USER)
def group_event_details_json(request, organization, project, group_id, event_id_or_latest):
    group = get_object_or_404(Group, pk=group_id, project=project)

    if event_id_or_latest == 'latest':
        # It's possible that a message would not be created under certain
        # circumstances (such as a post_save signal failing)
        event = group.get_latest_event() or Event(group=group)
    else:
        event = get_object_or_404(group.event_set, pk=event_id_or_latest)

    Event.objects.bind_nodes([event], 'data')
    GroupMeta.objects.populate_cache([group])

    return HttpResponse(json.dumps(event.as_dict()), mimetype='application/json')


@login_required
@has_access(MEMBER_USER)
def group_plugin_action(request, organization, project, group_id, slug):
    group = get_object_or_404(Group, pk=group_id, project=project)

    try:
        plugin = plugins.get(slug)
    except KeyError:
        raise Http404('Plugin not found')

    GroupMeta.objects.populate_cache([group])

    response = plugin.get_view_response(request, group)
    if response:
        return response

    redirect = request.META.get('HTTP_REFERER') or reverse('sentry-stream', kwargs={
        'organization_slug': organization.slug,
        'project_id': group.project.slug
    })
    return HttpResponseRedirect(redirect)
