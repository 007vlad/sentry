"""
sentry.rules.conditions.base
~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from sentry.rules.base import RuleBase


class EventCondition(RuleBase):
    rule_type = 'condition/event'

    def passes(self, event, is_new, is_regression, is_sample, **kwargs):
        raise NotImplementedError
