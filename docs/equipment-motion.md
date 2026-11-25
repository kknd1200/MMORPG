# 착용 무기 프레임 수정

무기를 캐릭터 옆에 붙이던 처리를 프레임별 손 좌표와 아이템 손잡이 좌표의 결합으로 변경했다. 무기를 먼저 그리고 손가락을 마지막에 그려 실제로 손잡이를 잡도록 한다.

기사와 전사의 남녀 대기·걷기·일반공격·스킬 몸통은 원본 검을 제거한 별도 시트를 사용한다. 공격 프레임에서 다른 무기가 다시 등장하는 원본 시트 대체 경로도 차단했다. 기존 캐릭터 파일은 보존한다.

- `assets/chars/rigged`: 런타임 몸통·손 레이어
- `js/data/equipment-rig.js`: 8방향, 2,000프레임의 손 위치·무기 각도
- `js/data/equipment-grips.js`: 아이템 원본 셀의 손잡이·칼끝 기준
- `tools/rig/inpainted`: 원본 무기를 지운 편집 원화
- `tools/rig/build_equipment_rig.py`: 원화 정규화·팔레트·손 좌표·아틀라스 생성

전체 재생성: Pillow, NumPy, SciPy가 설치된 Python에서 `python tools/rig/build_equipment_rig.py`. 특정 팩만 다시 만들려면 뒤에 `warrior warrior_female`처럼 이름을 전달한다. 편집 원화의 1254px 이미지는 1280px 격자로 먼저 정규화한다.

`npm start` 후 `/tools/equipment-motion-review.html`에서 직업·성별·장비·방향·동작을 선택해 실제 게임 렌더러로 연속 재생 및 8프레임 확인이 가능하다.

검증: 단위/회귀 테스트, 실제 게임 Canvas 렌더러를 사용한 방향별 연속 프레임 출력. 자동 Chromium 실행은 실행 환경의 소켓 제한으로 차단되어 브라우저 실화면 검증은 완료하지 못했다.
