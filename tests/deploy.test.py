"""Run inside an isolated root Docker container; no real Docker socket is mounted."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import unittest

MOCK = Path('/tmp/deploy-mock')
OLD = 'sha256:' + 'a' * 64
NEW = 'sha256:' + 'b' * 64
DIGEST = 'sha256:' + 'c' * 64
REVISION = 'd' * 40

class DeploymentTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if os.geteuid() != 0 or not Path('/.dockerenv').exists():
            raise RuntimeError('Run these tests only in the documented isolated Docker container.')
        Path('/etc/pennywise-401k').mkdir(exist_ok=True)
        Path('/etc/pennywise-401k/compose.production.yaml').write_text('fixture')
        Path('/run/lock').mkdir(parents=True, exist_ok=True)
        docker = r'''#!/usr/local/bin/python3
import sys,json,pathlib
root=pathlib.Path('/tmp/deploy-mock'); state=json.loads((root/'state').read_text())
a=sys.argv[1:]
with (root/'calls').open('a') as f:f.write(json.dumps(a)+'\n')
old='sha256:'+'a'*64; new='sha256:'+'b'*64
if a[0]=='login':
 token=sys.stdin.read()
 if token!='test-token':sys.exit(1)
elif a[0]=='pull':
 if state.get('pull_failure'):sys.exit(1)
elif a[:2]==['image','inspect']:
 if '--format' not in a:sys.exit(0)
 fmt=a[a.index('--format')+1]
 print(state.get('revision','d'*40) if 'revision' in fmt else (old if a[-1]==old else new))
elif a[0]=='inspect':print(state.get('current',old))
elif a[0]=='compose':
 assert '--no-deps' in a and '--no-build' in a and a[-1]=='app'
 assert a[a.index('--project-name')+1]=='pennywise-401k'
 assert a[a.index('--file')+1]=='/etc/pennywise-401k/compose.production.yaml'
 import os
 state['current']=old if os.environ['PENNYWISE_IMAGE']==old else new
 (root/'state').write_text(json.dumps(state))
else:sys.exit(2)
'''
        curl = r'''#!/usr/local/bin/python3
import sys,json,pathlib
state=json.loads(pathlib.Path('/tmp/deploy-mock/state').read_text())
assert sys.argv[-1]=='http://127.0.0.1:3001/'
sys.exit(1 if state.get('health_failure') and state.get('current')=='sha256:'+'b'*64 else 0)
'''
        for name, content in {'docker': docker, 'curl': curl, 'sleep':'#!/bin/sh\nexit 0\n'}.items():
            p=Path('/usr/bin')/name
            p.write_text(content); p.chmod(0o755)

    def setUp(self):
        MOCK.mkdir(exist_ok=True)
        (MOCK/'state').write_text('{}')
        (MOCK/'calls').write_text('')
        shutil.rmtree('/var/lib/pennywise-401k',ignore_errors=True)

    def run_deploy(self, revision=REVISION, digest=DIGEST, options=None):
        (MOCK/'state').write_text(json.dumps(options or {}))
        return subprocess.run(['bash','/source/deploy/deploy.sh'],
            input=f'{revision}\n{digest}\ntest-token\n',text=True,capture_output=True,timeout=10)

    def calls(self):
        return [json.loads(x) for x in (MOCK/'calls').read_text().splitlines()]

    def test_success_records_previous_image_and_removes_credentials(self):
        result=self.run_deploy()
        self.assertEqual(result.returncode,0,result.stderr)
        self.assertEqual(Path('/var/lib/pennywise-401k/previous-image').read_text().strip(),OLD)
        self.assertEqual(Path('/var/lib/pennywise-401k/current').read_text().splitlines(),[REVISION,NEW])
        self.assertFalse(list(Path('/run').glob('pennywise-401k-auth.*')))
        self.assertNotIn('test-token',result.stdout+result.stderr+(MOCK/'calls').read_text())

    def test_bad_health_restores_previous_image(self):
        result=self.run_deploy(options={'health_failure':True})
        self.assertNotEqual(result.returncode,0)
        self.assertIn('Rollback healthy',result.stderr)
        self.assertEqual(json.loads((MOCK/'state').read_text())['current'],OLD)
        self.assertEqual(len([x for x in self.calls() if x[0]=='compose']),2)
        self.assertFalse(Path('/var/lib/pennywise-401k/current').exists())

    def test_pull_failure_does_not_restart_any_container(self):
        result=self.run_deploy(options={'pull_failure':True})
        self.assertNotEqual(result.returncode,0)
        self.assertFalse([x for x in self.calls() if x[0]=='compose'])

    def test_revision_mismatch_cannot_deploy(self):
        result=self.run_deploy(options={'revision':'e'*40})
        self.assertNotEqual(result.returncode,0)
        self.assertIn('revision mismatch',result.stderr)
        self.assertFalse([x for x in self.calls() if x[0]=='compose'])

    def test_invalid_inputs_never_reach_docker(self):
        for revision,digest in [('$(touch /tmp/injected)',DIGEST),(REVISION,'latest'),(REVISION,DIGEST+';echo bad')]:
            with self.subTest(revision=revision,digest=digest):
                (MOCK/'calls').write_text('')
                result=self.run_deploy(revision,digest)
                self.assertNotEqual(result.returncode,0)
                self.assertEqual(self.calls(),[])
        self.assertFalse(Path('/tmp/injected').exists())

    def test_manual_rollback_uses_cached_image(self):
        self.assertEqual(self.run_deploy().returncode,0)
        (MOCK/'calls').write_text('')
        result=subprocess.run(['bash','/source/deploy/deploy.sh','--rollback'],capture_output=True,text=True,timeout=10)
        self.assertEqual(result.returncode,0,result.stderr)
        self.assertEqual(json.loads((MOCK/'state').read_text())['current'],OLD)
        self.assertFalse([x for x in self.calls() if x[0] in ['pull','login']])

if __name__=='__main__':unittest.main(verbosity=2)
