from django.core.urlresolvers import reverse
from sentry.models import AccessGroup
from sentry.testutils import APITestCase


class TeamAccessGroupIndexTest(APITestCase):
    def test_simple(self):
        team = self.create_team()
        group_1 = AccessGroup.objects.create(team=team, name='bar')
        group_2 = AccessGroup.objects.create(team=team, name='foo')

        self.client.force_authenticate(user=team.owner)

        url = reverse('sentry-api-0-team-access-group-index', kwargs={
            'team_id': team.id,
        })
        response = self.client.get(url)
        assert response.status_code == 200
        assert len(response.data) == 2
        assert response.data[0]['id'] == str(group_1.id)
        assert response.data[1]['id'] == str(group_2.id)
