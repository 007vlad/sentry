from sentry.api.base import Endpoint
from sentry.api.serializers import serialize
from sentry.models import Event, Group


class GroupEventsEndpoint(Endpoint):
    def get(self, request, group_id):
        group = Group.objects.get(
            id=group_id,
        )
        events = Event.objects.filter(
            group=group
        )

        return self.paginate(
            request=request,
            queryset=events,
            order_by='-datetime',
            on_results=lambda x: serialize(x, request),
        )
