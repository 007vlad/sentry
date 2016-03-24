from __future__ import absolute_import, print_function

import posixpath

from sentry.models import Project
from sentry.plugins import Plugin2
from sentry.lang.native.symbolizer import make_symbolizer, have_symsynd


def exception_from_apple_error_or_diagnosis(error, diagnosis=None):
    error = error or {}

    if error:
        nsexception = error.get('nsexception')
        if nsexception:
            return {
                'type': nsexception['name'],
                'value': error['reason'],
            }

    if diagnosis:
        return {
            'type': 'Error',
            'value': diagnosis
        }


def inject_apple_backtrace(data, frames, diagnosis=None, error=None,
                           system=None):
    # TODO:
    #   in-app (based on global/project dsym?)
    #   instruction_offset:
    #       image + offset
    #       symbol if found + offset
    #   pad out addresses in UI
    #   user report stacktraces from unity

    if system:
        app_uuid = system.get('app_uuid').lower()
    else:
        app_uuid = None

    converted_frames = []
    for frame in frames:
        fn = frame.get('filename')
        in_app = False

        if app_uuid is not None:
            frame_uuid = frame.get('uuid')
            if frame_uuid == app_uuid:
                in_app = True

        converted_frames.append({
            'in_app': in_app,
            'abs_path': fn,
            'filename': fn and posixpath.basename(fn) or None,
            # This can come back as `None` from the symbolizer, in which
            # case we need to fill something else in or we will fail
            # later fulfill the interface requirements which say that a
            # function needs to be provided.
            'function': frame['symbol_name'] or '<unknown>',
            'package': frame['object_name'],
            'symbol_addr': hex(frame['symbol_addr']),
            'instruction_addr': hex(frame['instruction_addr']),
            'instruction_offset':
                frame['instruction_addr'] - frame['symbol_addr'],
            'lineno': frame.get('line'),
        })

    stacktrace = {'frames': converted_frames}

    if error or diagnosis:
        if diagnosis is not None:
            data['culprit'] = diagnosis
        error = error or {}
        exc = exception_from_apple_error_or_diagnosis(error, diagnosis)
        if exc is not None:
            exc['stacktrace'] = stacktrace
            data['sentry.interfaces.Exception'] = exc
            return

    data['sentry.interfaces.Stacktrace'] = stacktrace


def preprocess_apple_crash_event(data):
    crash_report = data.get('sentry.interfaces.AppleCrashReport')
    if crash_report is None:
        return

    project = Project.objects.get_from_cache(
        id=data['project'],
    )

    crash = crash_report['crash']
    crashed_thread = None
    for thread in crash['threads']:
        if thread['crashed']:
            crashed_thread = thread
    if crashed_thread is None:
        return

    sym = make_symbolizer(project, crash_report['binary_images'],
                          threads=[crashed_thread])
    with sym.driver:
        bt = sym.symbolize_backtrace(crashed_thread['backtrace']['contents'])
        inject_apple_backtrace(data, bt, crash.get('diagnosis'),
                               crash.get('error'), crash_report.get('system'))

    return data


class NativePlugin(Plugin2):
    can_disable = False

    def get_event_preprocessors(self, **kwargs):
        if not have_symsynd:
            return []
        return [preprocess_apple_crash_event]
