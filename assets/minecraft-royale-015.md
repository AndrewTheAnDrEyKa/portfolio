# Minecraft Royale 0.15.0 - FEATURE COMPLETE CANDIDATE

## Большой совмещённый патч 0.11-0.15

**Статус документа:** проектный патчноут и целевой объём версии.  
**База:** актуальная рабочая ветка после 0.10.x / текущей сборки, которая фактически имеется у разработчика.  
**Цель:** собрать почти все крупные системы игры в одну feature-complete версию, после чего провести один огромный итоговый аудит и выпустить отдельный fix-only патч `0.15.1 Final Stabilization`.

> Важно: 0.15.0 не считается "идеально сбалансированной финальной игрой". Это первая версия, в которой должны одновременно существовать все ключевые игровые, тестовые, диагностические, организационные и турнирные системы. После неё запрещено бесконечно наращивать контент до завершения большого живого теста.

---

# 0. Главная идея 0.15.0

0.15.0 объединяет несколько ранее разнесённых внутренних этапов:

- 0.11 - Test Lab, управляемое время, диагностика и Audit Engine;
- 0.12 - Balance Lab, MRP, TTK, telemetry, matchup/team formula;
- 0.13 - entity/event visual overhaul, артиллерия, RuntimeEntityRegistry;
- 0.14 - инфраструктура, права, presentation, spectator/referee layers;
- 0.15 - Lobby, Ready Room, Telegram, tournament flow и полный feature-complete слой.

В этой версии Minecraft Royale должен перейти из состояния:

> "большой кастомный игровой режим, который мы постоянно вручную проверяем по кускам"

в состояние:

> "цельная игра, которую можно запустить, провести, контролировать, диагностировать, записать, завершить, сбросить и повторить без ручного ремонта сервера".

Ключевые приоритеты:

- CONTROL
- CONSISTENCY
- TESTABILITY
- BALANCE
- READABILITY
- SPECTACLE
- MEDIA VALUE
- RESET SAFETY
- SECOND-MATCH SAFETY

---

# 1. Общая архитектурная цель

К 0.15.0 плагин должен перестать зависеть от большого количества разрозненных таймеров, локальных runtime-state, временных listener-hacks и скрытых переходов.

Нужны централизованные сервисы:

- MatchSession
- MatchClock
- PhaseService
- TimeSeekService
- ScoreService
- OutpostService
- CombatDamageService
- CooldownService
- ClassSupplyService
- EventDirector
- EconomyService
- ResourceGeneratorService
- QuartermasterService
- RuntimeEntityRegistry
- ProtectionService
- AuditService
- TelemetryService
- MatchReportService
- MatchCleanupService
- ExternalControlGateway / Telegram bridge

Каждая система должна иметь:

- понятный owner;
- явный lifecycle;
- start;
- pause;
- resume;
- stop;
- reset;
- cleanup;
- second-match behavior.

Никакой runtime-state не должен переживать матч случайно.

---

# 2. MatchSessionId и изоляция матчей

Каждый матч получает уникальный `matchSessionId`.

Все временные объекты должны знать, к какой сессии относятся:

- team membership;
- captain state;
- ready state;
- selected class;
- cooldowns;
- class consumables;
- disguise;
- marks;
- temporary buffs;
- events;
- event entities;
- artillery shells;
- mines;
- sensors;
- smoke;
- temporary holograms;
- telemetry;
- audit events;
- Telegram state.

Если объект принадлежит старой сессии:

- он не должен влиять на новый матч;
- должен быть удалён или проигнорирован;
- Audit Engine должен уметь обнаружить stale-state.

Пример критической ошибки:

`905 MULTIPLE_ACTIVE_MATCH_SESSIONS`

---

# 3. Единый MatchClock

В 0.15.0 появляется полноценный управляемый игровой clock.

Это не просто GUI timer.

Все системы, зависящие от времени матча, должны читать время из одного `MatchClock`.

Запрещается разбрасывать критическую игровую логику по:

- `System.currentTimeMillis()`;
- случайным BukkitRunnable;
- локальным timestamp-полям без связи с MatchClock.

MatchClock должен иметь как минимум три режима:

## RUNNING
Игровое время идёт в реальном темпе.

## PAUSED
Обычная пауза матча.

Останавливаются:
- clock;
- score ticks;
- capture;
- events;
- class supplies;
- generators;
- cooldown progression, если cooldown считается game-time;
- Final Domination respawn penalty progression;
- временные event-duration.

## STATIC_TEST
Игровое время стоит, но сама игра остаётся активной.

Можно:
- сражаться;
- менять команды;
- использовать abilities;
- покупать;
- захватывать;
- запускать события вручную;
- менять score;
- тестировать классы;
- тестировать economy.

---

# 4. Test Clock - базовые операции

Новый рекомендуемый command tree:

```text
/royale test clock status
/royale test clock start
/royale test clock stop
/royale test clock mode static
/royale test clock mode running

/royale test clock add 1s
/royale test clock add 10s
/royale test clock add 60s
/royale test clock add 5m
/royale test clock add 19m30s

/royale test clock subtract 30s
/royale test clock subtract 5m

/royale test clock set 19m30s
/royale test clock set 40m
/royale test clock set 1h10m

/royale test clock seek 19m30s
/royale test clock seek 55m
```

Duration parser должен понимать:

- `45s`
- `5m`
- `19m30s`
- `1h`
- `1h10m`
- `1h10m30s`

Некорректный syntax:

`400 CLOCK_TIME_SYNTAX_INVALID`

---

# 5. Clock SET и SEEK

Нужно различать простое изменение clock и полноценный переход между фазами.

## SET

Если новое время остаётся внутри текущей стадии:

- меняется позиция clock;
- runtime не перестраивается полностью.

Пример:

Preparation:
`10:00 -> 15:00`

## SEEK

Если новое время пересекает фазовую границу:

- определяется target phase;
- текущая фазовая логика корректно выгружается;
- target phase state применяется заново;
- multipliers пересчитываются;
- generators включаются/выключаются;
- events переводятся в корректный режим;
- capture profile обновляется;
- vendor tier обновляется;
- supply profile обновляется;
- respawn profile обновляется;
- HUD reconciles.

---

# 6. Ключевой тест TimeSeek

Допустим Preparation заканчивается на `20:00`.

Тест:

1. Запустить STATIC_TEST.
2. Clock = `00:00`.
3. `/royale test clock set 19m30s`
4. Проверить, что всё ещё Preparation.
5. `/royale test clock start`
6. Через 30 секунд должен произойти настоящий переход в WAR.
7. `/royale test clock stop`
8. Проверить WAR systems.
9. `/royale test clock seek 19m30s`
10. Игра обязана вернуться в Preparation semantics.

После возврата назад не должны оставаться:

- WAR generators;
- active outposts;
- WAR events;
- WAR supply profile;
- WAR respawn profile;
- WAR vendor tier;
- WAR score tick;
- WAR-only buffs.

Это обязательный acceptance gate.

---

# 7. TimeSeek не должен дюпать phase-entry rewards

При переходах вперёд/назад через тестовый clock нельзя бесконечно фармить:

- class refill;
- escalation refill;
- event reward;
- economy bonus;
- endgame unlock.

TimeSeek должен работать в явном TEST context.

В production повторный phase-enter из-за seek невозможен.

В TEST:
- либо phase-entry rewards имеют reversible state;
- либо test seek применяет stage-state без экономически дюпающих side effects;
- либо developer может отдельно вызвать `apply-entry-rewards`.

Нельзя связывать изменение отображаемого времени с бесконтрольным созданием предметов.

---

# 8. Test Clock bookmarks

Желательно добавить:

```text
/royale test clock mark <name>
/royale test clock goto <name>
/royale test clock marks
/royale test clock unmark <name>
```

Минимальная версия bookmark:
- сохраняет match time;
- target phase;
- score snapshot;
- outpost owners.

Полный world snapshot в 0.15 не обязателен.

---

# 9. Test Sandbox 2.0

TEST admin должен иметь возможность в любой игровой фазе:

- менять team;
- менять captain;
- менять class;
- менять bans;
- менять ready;
- обновлять kit;
- выдавать class consumable;
- очищать cooldown;
- изменять score;
- задавать owner аванпоста;
- задавать capture progress;
- force phase;
- force Domination;
- force Final Domination;
- force event;
- включать/выключать fortress protection;
- принудительно убивать/respawn игрока;
- переключать generator;
- выдавать resources;
- открывать Vendor tier;
- запускать artillery;
- запускать individual ability;
- включать telemetry;
- запускать audit.

TEST обходится с gameplay restrictions свободно.

TEST не может обходить technical safety.

Запрещено даже в TEST:

- ломать `royale_template`;
- запускать два reset одновременно;
- создать вторую MatchSession;
- указать unknown class;
- указать unknown phase;
- установить Command Point вне допустимого мира;
- создать invalid region;
- оставить runtime entity без session owner.

---

# 10. Royale Audit Engine

0.15.0 получает большую скрытую диагностическую систему.

Главная задача:

> после большого теста пользователь должен скопировать короткий технический блок и отправить его разработчику/в ChatGPT, не пытаясь вручную объяснять, что именно сломалось.

Audit Engine по умолчанию скрыт от обычных игроков.

Доступ:
- developer;
- admin;
- referee при необходимости;
- отдельно scoped team-audit может быть доступен капитану, если это разрешено config.

---

# 11. Audit code scheme

Базовая схема:

## 2xx - Success / health
- 200 OK
- 201 CREATED
- 202 ACCEPTED
- 206 PARTIAL / DEGRADED BUT OPERABLE

## 4xx - User/state/config request
- 400 BAD_SYNTAX
- 403 FORBIDDEN
- 404 OBJECT_NOT_FOUND
- 409 STATE_CONFLICT
- 422 LOGICALLY_INVALID
- 429 COOLDOWN_OR_RATE_LIMIT

## 5xx - Internal subsystem
- 500 INTERNAL_ERROR
- 503 SUBSYSTEM_UNAVAILABLE

## 7xx - Map / region / world
- 701 ARENA_BOUNDARY_MISSING
- 702 TEMPLATE_NOT_FOUND
- 703 MATCH_WORLD_NOT_LOADED
- 704 COMMAND_POINT_OUTSIDE_FORTRESS
- 705 FORTRESS_REGION_INVALID
- 706 OUTPOST_REGION_INVALID
- 707 GENERATOR_REGION_MISSING
- 708 QUARTERMASTER_ANCHOR_MISSING
- 709 REGION_OVERLAP_INVALID

## 8xx - Gameplay runtime
- 801 CLASS_RUNTIME_INVALID
- 802 PLAYER_TEAM_STALE
- 803 COOLDOWN_STATE_INVALID
- 804 CORE_ITEM_DUPLICATION
- 805 RESPAWN_ESSENTIALS_MISSING
- 806 EVENT_STATE_STALE
- 807 RUNTIME_ENTITY_ORPHANED
- 808 GENERATOR_STATE_DESYNC
- 809 VENDOR_TEAM_STATE_INVALID
- 810 CLASS_SUPPLY_DESYNC
- 811 OUTPOST_CAPTURE_DESYNC
- 812 DOMINATION_STATE_DESYNC
- 813 FINAL_DOMINATION_STATE_DESYNC
- 814 SUDDEN_SCORE_DESYNC
- 815 PHASE_PROFILE_MISMATCH
- 816 CLOCK_PHASE_MISMATCH
- 817 PHASE_ENTRY_SIDE_EFFECT_DUPLICATED
- 818 INVALID_RESPAWN_PROFILE
- 819 FRIENDLY_FIRE_POLICY_BROKEN

## 9xx - Critical invariant
- 901 SCORE_INVARIANT_BROKEN
- 902 TERMINAL_SCORE_WITHOUT_FINISH
- 903 TEMPLATE_MODIFIED_DURING_MATCH
- 904 RESET_INCOMPLETE
- 905 MULTIPLE_ACTIVE_MATCH_SESSIONS
- 906 SECOND_MATCH_STALE_STATE
- 907 PLAYER_IN_TWO_TEAMS
- 908 TWO_CLASSES_ACTIVE
- 909 TWO_MAJOR_EVENTS_CONFLICT
- 910 WORLD_SESSION_MISMATCH

---

# 12. Audit scopes

Команды:

```text
/royale audit match
/royale audit team red
/royale audit team blue
/royale audit player <player>
/royale audit map
/royale audit phase
/royale audit clock
/royale audit score
/royale audit outposts
/royale audit events
/royale audit economy
/royale audit combat
/royale audit entities
/royale audit classes
```

---

# 13. Audit output levels

## NORMAL

Показывает:

```text
MATCH AUDIT
200 Session
200 Clock
200 Score
206 BLUE Team
811 MID Capture
200 Events
```

## VERBOSE

Добавляет:
- expected;
- actual;
- context;
- recent state transitions.

## COMPACT EXPORT

```text
/royale audit export compact
```

Пример:

```text
MCRAUDIT/0.15
build=0.15.0-SNAPSHOT
session=4b8c1c0e
phase=WAR
time=26:41

811|ERROR|OUTPOST_CAPTURE_DESYNC|outpost=mid|player=PuperSuperYT|inside=true|participant=false
901|CRITICAL|SCORE_INVARIANT_BROKEN|red=611|blue=388|sum=999
708|WARN|QUARTERMASTER_ANCHOR_MISSING|team=BLUE
```

---

# 14. Audit fingerprinting

Одинаковая ошибка не должна спамить сотни строк.

Каждая audit error получает fingerprint.

Пример:

```text
fingerprint=811:mid:PuperSuperYT
firstSeen=26:41
lastSeen=27:12
count=31
```

В финальном report это одна агрегированная проблема.

---

# 15. Audit recent-actions trace

Для сложных ошибок желательно хранить короткую цепочку последних действий:

```text
26:39.102 EVENT_END OUTPOST_SHUTDOWN
26:39.104 OUTPOST_ENABLE BLUE_LINE
26:39.108 CAPTURE_RECALC ALL
26:39.110 HUD_REFRESH
26:41.001 AUDIT_FAIL 811 MID
```

Это особенно важно для:

- Outpost Shutdown;
- phase seek;
- Reset;
- Domination;
- Event end;
- reconnect;
- class switch в TEST.

---

# 16. Audit Watch

Режим:

```text
/royale audit watch on
/royale audit watch off
/royale audit watch status
```

Watch:
- не спамит 200 OK;
- пишет только новые WARN/ERROR/CRITICAL;
- агрегирует повторы;
- сохраняет timestamps.

---

# 17. Final Match Audit Report

После матча:

```text
/royale audit report
```

Создаётся файл:

```text
plugins/MinecraftRoyale/audit/
match-<sessionId>-<timestamp>.txt
```

или JSON + human-readable TXT.

Содержимое:
- plugin version;
- Paper version;
- session ID;
- mode;
- duration;
- players;
- team roster;
- captains;
- classes;
- phase transitions;
- score history;
- outpost ownership;
- Domination;
- Sudden;
- Final Domination;
- events;
- deaths;
- kills;
- assists;
- abilities;
- economy totals;
- warnings;
- errors;
- failed invariants;
- reset result.

---

# 18. MRP - Minecraft Royale Points

0.15.0 вводит внутреннюю систему баланса:

**MRP = Minecraft Royale Points**

MRP не показывается обычным игрокам.

Это developer accounting system.

Цель:
- дать каждому элементу игры измеряемую стоимость;
- перестать балансировать классы только "по ощущению";
- видеть, откуда возникает перевес;
- связывать теоретический баланс с реальной telemetry.

---

# 19. Базовый класс MRP

За эталон принять **Assault / Штурмовик**.

После первичной калибровки:

```text
Assault ≈ 100 MRP
```

100 не является магическим числом.

Это просто нормализованный baseline.

Классы могут иметь:

- 98.63
- 100.41
- 101.27

Не округлять всё до 5 или 10.

---

# 20. Что получает MRP

Оценивать вообще всё, что реально влияет на матч.

## BODY
- HP;
- каждое дополнительное сердце;
- Armor;
- Armor Toughness;
- Knockback Resistance;
- Movement Speed;
- Attack Speed;
- jump modifiers;
- permanent status effects.

## WEAPONS
- raw damage;
- burst damage;
- sustained DPS;
- range;
- projectile speed;
- accuracy;
- AoE;
- armor penetration;
- knockback;
- reliability;
- reload;
- ammo;
- cooldown.

## CORE ITEMS
- уникальные механики;
- utility;
- survivability;
- mobility;
- information;
- zoning.

## ABILITIES
- damage;
- control;
- movement;
- area denial;
- healing;
- cleanse;
- detection;
- disguise;
- lethal prevention;
- crowd control;
- cooldown;
- charges.

## RESOURCES
- start stock;
- periodic refill;
- max stock;
- purchase availability;
- scarcity.

## DRAWBACKS
- slow;
- weakness;
- self-damage;
- exhaustion;
- ammo dependence;
- long cooldown;
- limited range.

## SYNERGY
- способность + weapon;
- ability chains;
- passive + armor;
- team synergy.

---

# 21. Нельзя подгонять MRP

Критический принцип:

MRP нельзя менять ради красивой суммы.

Если расчёт показал:

```text
Odin = 107.83 MRP
```

запрещено написать:

```text
Hunger drawback = -7.83
```

если Hunger почти ничего не меняет.

Правильный процесс:

1. измерить;
2. посчитать;
3. увидеть перевес;
4. найти источник;
5. изменить механику;
6. пересчитать;
7. повторить тест.

---

# 22. Hunger и микронедостатки

Если еды достаточно:
- она возвращается после respawn;
- её можно купить;
- она лежит в essentials;

тогда Hunger может стоить условно:

`-0.1 ... -0.5 MRP`

а не:
`-5 ... -10 MRP`.

MRP оценивает **реальное влияние**, а не формальное наличие эффекта.

---

# 23. Marginal MRP

Одно дополнительное сердце не имеет универсальной цены.

Пример:

Scout:
- +2 HP увеличивает average TTK на 4%.

Odin:
- +2 HP за тяжёлой armor увеличивает effective survivability на 7%.

Значит дополнительное сердце Odin объективно дороже.

Так же считать:
- armor;
- toughness;
- resistance;
- movement.

---

# 24. MRP scenario profile

Для каждого класса вести не только Total.

Пример:

```text
Saboteur
Overall      99.6
Open Duel    82.4
Ambush      126.1
Objective   109.7
Teamfight    91.3
Siege       103.5
```

Класс может быть очень сильным в своей нише.

Это нормально.

Проблема:
- если один класс имеет высокий рейтинг почти во всех сценариях.

---

# 25. Стандартные сценарии MRP

Минимум:

- Open Duel
- Close Range
- Mid Range
- Long Range
- Ambush
- Objective Fight
- Siege
- Retreat
- Chase
- 2v2
- 3v3
- 5v5 Teamfight
- Full Resources
- Low Resources
- No Cooldowns Ready
- Final Escalation

---

# 26. TTK Matrix 16x16

Для всех классов:

- TTK A -> B;
- TTK B -> A;
- full resources;
- no signature ready;
- short-range;
- medium-range;
- ambush.

Не обязательно превращать это сразу в "вероятность победы".

Но должна существовать фактическая таблица combat performance.

---

# 27. Team Role Matrix

Каждый класс получает role weights:

- Frontline
- Burst
- Ranged
- Control
- Recon
- Mobility
- Sustain
- Siege
- Support
- Objective
- Anti-Heavy
- Anti-Flank

Пример:

```text
Odin
Frontline 100
Siege 70
Burst 50
Mobility 15
Recon 0
```

```text
Scout
Recon 100
Mobility 100
Burst 40
Frontline 10
```

---

# 28. Team Balance Formula

Команда оценивается не простой суммой 5 MRP.

Модель:

```text
TeamRating =
RawClassMRP
+ RoleCoverage
+ Synergy
+ CounterCoverage
+ ObjectivePower
- RoleOverlap
- CounterVulnerability
- ResourceConflict
```

MRP не используется для live auto-balance.

Никакого скрытого rubber-banding.

Это developer tool для:
- Draft balance;
- class redesign;
- ban analysis;
- post-match review.

---

# 29. MRP Balance Ledger

Обязательный deliverable:

`MRP_BALANCE_LEDGER.md`

Дополнительно желательно:

- `mrp-values.json`
- `ttk-matrix.csv`
- `matchup-matrix.csv`
- `role-matrix.csv`

В Ledger:
- MRP standard;
- Assault baseline;
- body values;
- armor values;
- movement values;
- weapons;
- abilities;
- consumables;
- drawbacks;
- synergy;
- all 16 classes;
- known deviations;
- notes after live tests.

---

# 30. Telemetry Service

0.15.0 должен собирать данные, которые реально помогут корректировать MRP.

По игроку:
- damage dealt;
- damage received;
- kills;
- assists;
- deaths;
- healing;
- damage prevented;
- objective time;
- captures;
- deaths on objective;
- class resources spent;
- class resources wasted;
- survival time;
- distance travelled;
- combat duration.

По ability:
- casts;
- hits;
- misses;
- damage;
- kills;
- assists;
- targets affected;
- average range;
- average value;
- cooldown uptime.

По классу:
- average TTK;
- median TTK;
- K/D;
- assist rate;
- objective contribution;
- survival;
- ability efficiency.

---

# 31. Combat Overhaul - final architecture

Все кастомные damage systems должны идти через единый `CombatDamageService`.

`DamageContext`:

- attacker;
- victim;
- source;
- ability;
- projectile;
- base damage;
- final damage;
- damage type;
- phase;
- armor;
- armor piercing;
- headshot/crit if applicable;
- cover exposure if applicable;
- event modifiers;
- class modifiers;
- lethal prevention;
- knockback.

Damage Types:

- MELEE
- PROJECTILE
- EXPLOSIVE
- ARTILLERY
- TRAP
- ABILITY
- ENVIRONMENTAL
- TRUE_DAMAGE

---

# 32. PvP target

Целевой TTK:

- обычный бой: **10-25 секунд**
- Heavy vs Heavy: **20-35 секунд**

Не допускать:
- 5 минут еды;
- бесконечного natural regen;
- массовых shields;
- массовых Totems;
- бесконечных heals.

---

# 33. Natural regeneration

В `royale_match`:

`naturalRegeneration = false`

Лечение идёт через:
- food only if intentionally configured;
- Medic;
- class abilities;
- Vendor;
- events;
- rare items.

---

# 34. Totems

Vanilla Totem не является обычным массовым item.

Допустимые случаи:
- Odin Valhalla как class mechanic;
- Second Chance event;
- редкая future endgame mechanic.

Event Totem должен:
- иметь PDC;
- быть временным;
- не stash'иться;
- удаляться после event end, если не использован.

---

# 35. Shields

Shield должен быть в первую очередь identity Knight.

Остальные классы:
- либо не имеют;
- либо имеют сильно ограниченную временную механику;
- но не превращают бой в vanilla shield duel.

---

# 36. Combat tag

Добавить:

- combat tag ~8-10 sec;
- damage refreshes tag;
- logout under combat имеет penalty.

Penalty:
- death-equivalent;
- drop/respawn logic;
- никаких бесплатных escape через disconnect.

---

# 37. Assists

Assists считать по недавним damage contributors.

Ориентир:
- окно ~10 sec;
- configurable.

Kill feed должен показывать:
- killer;
- victim;
- weapon/ability;
- assist при необходимости.

---

# 38. Respawn Essentials

Разделить предметы на:

## TRUE CORE
Уникальные class-defining items:
- Gungnir;
- Cerberus;
- Finka;
- Artillery Designator;
- и т.д.

TRUE CORE:
- не дропается;
- не передаётся;
- не лутается;
- восстанавливается;
- не дюпается.

## RESPAWN ESSENTIALS
Базовый набор:
- еда;
- team banner;
- red/blue wool;
- базовые team blocks;
- маленький building kit.

Essentials:
- автоматически восстанавливаются после respawn;
- не должны считаться уникальными class Core Items.

---

# 39. Team wool

Каждая команда получает:
- RED Wool;
- BLUE Wool.

Цель:
- быстрые укрепления;
- маршруты;
- визуальное чтение battlefield.

Количество ограничить.

Ориентир:
- 16-24 blocks / life как стартовый диапазон.

Не превращать карту в BedWars-мусор.

---

# 40. Все 16 классов - единый стандарт

К 0.15 каждый класс должен иметь:

1. Primary
2. Signature
3. Utility
4. Passive
5. Resource/Cooldown
6. Weakness
7. MRP profile
8. Telemetry tags
9. Escalation scaling
10. Audit hooks

---

# 41. Knight

Identity:
- frontline;
- shield;
- удержание пространства.

Kit:
- Knight Blade
- Shield
- Bastion
- Shield Ram

Bastion:
- сильная frontal defense;
- knockback resistance;
- movement penalty;
- ограниченная duration.

Shield Ram:
- короткий controlled dash;
- knockback;
- interrupt.

Weakness:
- flank;
- low mobility;
- ranged pressure;
- David.

---

# 42. Archer

Identity:
- ranged pressure;
- pick potential;
- positioning.

Kit:
- Bow;
- scarce arrows;
- Piercing Shot;
- Grapple Arrow.

Piercing Shot:
- high-impact precision;
- не должен превращаться в бесплатный бесконечный one-shot.

Grapple Arrow:
- vertical/horizontal reposition;
- ограниченный cooldown/charges.

Weakness:
- close pressure;
- Mike;
- resource dependency.

---

# 43. Bombardier

Benchmark mechanical density.

Kit:
- Cerberus;
- triple SmallFireball;
- cassette ammo;
- Airburst.

Airburst:
- optional mid-air detonation;
- AoE damage;
- knockback;
- area pressure.

Weakness:
- close melee;
- ammo;
- self-positioning.

---

# 44. Assault

Baseline class для MRP.

Kit:
- reliable melee;
- Combat Stim;
- Breach Dash;
- Exhaustion.

Combat Stim:
- temporary speed;
- attack pressure;
- minor survivability if needed.

После:
- Exhaustion.

Breach Dash:
- controlled engagement tool.

Assault должен оставаться универсальным, но не лучшим во всех ролях.

---

# 45. Scout

Identity:
- recon;
- vertical mobility;
- escape/reposition.

Signature:

## Signal Burst

При использовании:
- vertical launch ~6-8 blocks;
- 0.6-1 sec short safety/fall protection;
- radial fireworks/projectiles;
- radial damage;
- knockback;
- strong visual identity.

Это escape/reposition tool, не длинная invulnerability.

Utility:
- Recon Pulse;
- reveal Saboteur disguise;
- short enemy-direction information.

---

# 46. Medic

Identity:
- limited combat sustain;
- cleanse;
- emergency save.

Kit:
- Trauma Injector;
- Cleanse Pulse;
- limited charges.

Trauma Injector:
- heal;
- short absorption.

Cleanse:
- Collector Debt;
- selected class debuffs;
- temporary negative effects.

Не делать бесконечное AoE healing.

---

# 47. Sapper

Identity:
- terrain control;
- anti-trap;
- defense.

Kit:
- control trap;
- Disarm;
- Portable Barricade.

Disarm:
- detect/remove Saboteur mines.

Barricade:
- limited;
- session-tagged;
- TECH safety compatible.

---

# 48. Teamlead

Identity:
- command/support;
- map-level tactical tools.

Kit:
- reliable primary;
- Artillery Designator;
- Recon Flare;
- Smoke Screen.

Artillery:
- сильная zoning ability;
- warning;
- cover counterplay;
- не ломает карту.

Recon Flare:
- краткая информация/mark.

Smoke:
- временное concealment/line-of-sight disruption.

---

# 49. Saboteur

Identity:
- ambush;
- disguise;
- traps.

Kit:
- Finka;
- Disguise;
- Mine.

Disguise:
- kill with Finka;
- copy victim appearance/team-readability in controlled way;
- не должен ломать actual team logic;
- Recon/Sapper counters.

Mine:
- logical trigger area ~3x3;
- nearly invisible enemy;
- friendly marker;
- enemy trigger only;
- heavy damage;
- knockback;
- short disorient/slow;
- Sapper disarm.

Start:
- около 1.
Periodic:
- да.
Max:
- около 2.
Final Esc:
- можно +1 max.

---

# 50. Odin

Identity:
- heavy;
- oppressive single-target;
- slow.

Kit:
- Gungnir;
- Valhalla.

Gungnir:
- powerful throw/strike;
- controlled return;
- strong visual shockwave;
- no destructive lightning/fire.

Valhalla:
- once per life lethal prevention;
- leave ~6 HP ориентировочно;
- brief Resistance;
- dramatic effects;
- затем Weakness либо short Gungnir disable.

Важно:
- никакого дополнительного постоянного slowdown от Valhalla.
- Odin и так heavy/slow.

Новый Valhalla только после настоящего respawn.

---

# 51. Tripple-T

Identity:
- displacement;
- movement;
- chaos.

Kit:
- Baton;
- Triple Leap.

Baton:
- massive controlled knockback.

Triple Leap:
- 3 movement charges;
- recharge;
- нельзя превращать в бесконечный полёт.

---

# 52. David

Identity:
- anti-heavy;
- ranged precision;
- biblical David/Goliath inspiration.

Kit:
- Sling;
- Giant Killer;
- Heavy Stone;
- Ricochet.

Giant Killer:
- value scales with target effective/max HP;
- без тупого `+25% vs Odin`.

Heavy Stone:
- strong projectile.

Ricochet:
- skill expression.

Knight shield остаётся логичным counter.

---

# 53. Mike

Identity:
- boxer;
- close-range combo.

Kit:
- Gloves;
- Combo;
- Knockout;
- Uppercut.

Combo:
- sequential hits build pressure.

Knockout:
- high-value finish/control.

Uppercut:
- vertical displacement.

Weakness:
- range;
- zoning.

---

# 54. Last

Identity:
- clutch;
- team-depletion scaling.

Kit:
- Heavy Crossbow;
- Last Stand;
- Dead Man’s Bolt;
- Last Breath.

Last Stand:
- растёт при уменьшении количества живых союзников;
- обязательно cap;
- не должен превращать проигрывающую команду в скрытый rubber-band.

Это class identity, а не match-wide comeback system.

---

# 55. Collector

Identity:
- target pressure;
- debt mechanic.

Kit:
- Collection Mace;
- Debtor;
- Interest;
- Collection.

Debtor:
- mark target.

Interest:
- pressure grows over time до cap.

Collection:
- pull/slow/finish tool.

Medic Cleanse:
- counter.

---

# 56. Paranoid

Identity:
- information;
- defensive reaction.

Kit:
- Heavy Crossbow;
- Proximity Alert;
- Sensor;
- Panic Shot.

Sensor:
- placeable;
- direction/sound warning;
- session-tagged;
- RuntimeEntityRegistry.

Panic Shot:
- emergency close-range response;
- cooldown.

---

# 57. Escalation System - final

Создать единый `EscalationProfile`.

Каждый profile задаёт:

- scoreRate;
- captureDuration;
- classSupplyMultiplier;
- cooldownMultiplier;
- resourceTier;
- vendorTier;
- eventIntensity;
- abilityStage;
- respawnTime.

---

# 58. WAR

- score = 1/sec per net advantage;
- capture ~45 sec;
- supply x1.00;
- cooldown x1.00;
- respawn ~12 sec;
- economy base;
- events moderate.

---

# 59. Escalation I - МОБИЛИЗАЦИЯ

При входе:
- +1 primary class consumable до maxStock.

- score = 1/sec;
- capture ~45 sec;
- supply interval x0.75;
- cooldown x0.90;
- respawn ~14 sec;
- stronger economy;
- Vendor Tier II;
- events ~4-6 min.

---

# 60. Escalation II - ТОТАЛЬНАЯ ВОЙНА

При входе:
- refill ~50% max class stock.

- score = 2/sec;
- capture ~35 sec;
- supply x0.50;
- cooldown x0.80;
- respawn ~16 sec;
- Diamond economy;
- Vendor Tier III;
- high-impact events ~3-5 min.

---

# 61. Final Escalation - ПОЛНАЯ МОБИЛИЗАЦИЯ

При входе:
- large/full-ish refill до caps.

- score = 3/sec;
- capture ~30 sec;
- supply x0.33;
- cooldown x0.70;
- respawn ~18 sec;
- endgame Vendor;
- Diamonds 1/sec;
- Netherite Block 1/min;
- events ~2-4 min;
- ability final variants.

Не давать:
- double Valhalla;
- бесконечные lethal prevention;
- глобальный massive damage multiplier.

---

# 62. Sudden Royale - полный redesign

При входе:

- main score freeze;
- RED SuddenScore = 0;
- BLUE SuddenScore = 0;
- only Mid active;
- Blue Line disabled;
- Red Line disabled.

Чистый Mid control:
- +1 Sudden point / 6 sec.

Contested/empty:
- 0.

Max:
- 100.

Hard duration:
- 600 sec.

Никакого overtime.

---

# 63. Sudden Royale win logic

Если 100:
- мгновенный конец Sudden.

Если 10:00:
- higher SuddenScore wins.

Tie-break:

1. frozen main score;
2. Mid owner;
3. kills during Sudden;
4. fewer deaths;
5. deterministic seeded random.

Winner:
- becomes attacker Final Domination.

---

# 64. Final Domination

Необратима.

Нет:
- DOMINATION BROKEN.

Победа:

A. 1000 main score.  
B. Command Point hold.

Scoring:

`5 points/sec` за net outpost advantage.

Примеры:
- 2-1 = +5/sec;
- 3-0 = +15/sec.

Command Point:
- ~90 sec configurable.

Respawn:
- attacker 26 sec;
- defender +5 sec каждые 90 sec;
- max 60 sec;
- Pause-safe.

---

# 65. Event Director 2.0

Event Director должен иметь:

- weighted selection;
- category;
- phase restrictions;
- cooldown;
- family cooldown;
- duration;
- major/minor flag;
- compatibility rules;
- cleanup handler;
- Audit hooks;
- telemetry;
- force-test command.

Категории:

- ICONIC
- TACTICAL
- CHAOS
- FINAL

---

# 66. Iconic events

Высокий weight:

1. Nightfall
2. Artillery Strike
3. Storm
4. Outpost Shutdown
5. Supply Drop
6. Generator Overload

Они должны ощущаться как signature moments Minecraft Royale.

---

# 67. Tactical / Chaos pool

Минимальный целевой pool 0.15:

1. Nightfall
2. Artillery Strike
3. Storm
4. Outpost Shutdown
5. Supply Drop
6. Generator Overload
7. Second Chance
8. Null Zone
9. Supply Surge
10. Low Gravity
11. Gold Rush
12. TNT Supply
13. Combat Frenzy
14. Heavy Casualties
15. Mobilization
16. Blackout
17. War Fog
18. Recon Sweep
19. Mob Surge
20. Open Passage
21. Bridge Collapse
22. Outpost Siege
23. Last Outpost
24. Emergency Medicine
25. Fortification Drop
26. Resource Drought
27. Ammunition Surge
28. Smoke Front
29. Shockwave
30. Final Reserve

Список может расширяться, но нельзя добавлять filler только ради числа.

---

# 68. Event anti-repeat

После выпадения event:

- его weight временно = 0;
- family cooldown;
- recent-history penalty.

Нельзя:
- Nightfall -> Nightfall;
- Outpost Shutdown -> Outpost Shutdown;
- три artillery event подряд без специальных условий.

---

# 69. Phase pools

WAR:
- tactical;
- iconic;
- first event примерно через 4-5 min;
- interval 5-7 min.

Esc I:
- iconic weight выше;
- interval 4-6 min.

Esc II:
- high-impact разрешены;
- interval 3-5 min.

Final Esc:
- chaos/high-impact;
- interval 2-4 min.

Sudden:
- safe pool;
- никогда не выключать Mid.

Final Domination:
- aggressive final pool;
- event не может сломать Command Point или terminal score.

---

# 70. Second Chance

При старте:
- каждому живому игроку временный event Totem.

PDC:
- event ID;
- session ID;
- expiry.

Неиспользованный:
- удаляется в конце event.

Не дропается как экономический ресурс.

---

# 71. Null Zone

На короткий период подавляет temporary effects.

Нельзя уничтожать class identity.

Разделять:
- BASE_CLASS_EFFECT
- TEMPORARY_EFFECT

После event:
- baseline class state reconciles.

---

# 72. Resource Economy - physical generator

Финальный вариант:

На каждой базе:
- generator zone 2x2 или 3x3;
- ресурсы физически появляются на полу;
- игроки подбирают их.

Не использовать магически пополняющийся chest как основной UX.

---

# 73. Resource rates

WAR:
- Coal 1/sec
- Iron 1/5 sec
- Gold 1/10 sec

Esc I:
- Coal 1/sec
- Iron 1/sec
- Gold 1/4 sec

Esc II:
- Coal 1/sec
- Iron 1/sec
- Gold 1/sec
- Diamond 1/5 sec

Final Esc:
- Coal 1/sec
- Iron 1/sec
- Gold 1/sec
- Diamond 1/sec
- Netherite Block 1/60 sec

---

# 74. Ground caps

Prototype:

- Coal 256
- Iron 256
- Gold 128
- Diamond 64
- Netherite Block 4

Generator не должен создавать 1000 Item entities.

Если compatible stack уже лежит:
- увеличить stack;
- или использовать ограниченное число entities.

---

# 75. Generator lifecycle

Preparation:
- OFF.

WAR:
- ON.

Pause:
- freeze.

Static Test:
- отдельно управляется test command.

Reset:
- удалить generated items;
- clear counters;
- clear timers.

Final Domination:
- работает согласно configured endgame profile.

---

# 76. Quartermaster

На каждой базе:
- RED Quartermaster;
- BLUE Quartermaster.

Protected Villager:
- AI off;
- invulnerable;
- no push;
- no wandering;
- no fire;
- no explosion.

ПКМ:
- Custom Vendor GUI.

---

# 77. Vendor categories

- Team Upgrades
- Tools
- Building
- Food
- Ammo
- Medical
- Endgame

Покупки:
- atomic;
- double-click safe;
- no dupe;
- team-aware.

---

# 78. Team armor upgrades

Не менять форму на vanilla Diamond Armor.

Командная uniform сохраняется визуально.

Armor upgrades:
- custom attribute modifiers;
- MRP tracked;
- team-wide state.

---

# 79. Class ammo purchase

Vendor должен понимать class.

Примеры:
- Archer -> arrows;
- Bombardier -> cassette;
- David -> sling stones;
- Last -> heavy bolts;
- Saboteur -> mine charges;
- Medic -> medical charges.

Enemy не получает class rights через украденный consumable.

---

# 80. Endgame purchases

Netherite Block может использоваться для:
- Combat Reserve;
- Generator Overload;
- Emergency Medicine;
- Fortification;
- team consumable refill.

Все endgame buys:
- symmetric;
- no comeback cheating.

---

# 81. TECH_IMMUTABLE

Защищать только техническое ядро:

- generator core;
- Quartermaster hut core;
- NPC anchor;
- objective technical bases;
- service blocks.

Не защищать всю Fortress.

TECH_IMMUTABLE блокирует:

- break;
- place;
- explosion;
- fire;
- piston;
- fluid;
- class abilities;
- artillery.

---

# 82. Arena Boundary

Логическая граница Арены.

Не строить wall of barriers.

Использовать:
- logical region;
- optional vanilla WorldBorder.

Блокировать:
- break outside;
- place outside;
- teleport outside;
- ability target outside;
- artillery target outside.

Projectiles leaving Arena:
- можно удалять.

---

# 83. Artillery Overhaul

Артиллерия должна стать одним из самых зрелищных элементов игры.

Главный принцип:

- spectacular;
- readable;
- dangerous;
- cover-counterable;
- map-safe.

---

# 84. Artillery projectile

Не использовать vanilla FallingBlock как единственную основу.

Предпочтительно:

- BlockDisplay;
- scripted high-speed trajectory;
- full brightness;
- glow;
- smoke/spark trail.

Высота:
- условно 70-100 blocks над impact area.

Скорость:
- примерно 30-60 blocks/sec.

Collision:
- raycast/segment collision каждый tick;
- projectile не пролетает землю.

---

# 85. Artillery warning

Перед ударом:

- ground marker;
- red/orange particles;
- incoming sound;
- короткий warning 2-4 sec;
- возможно directional whistling.

Игрок должен иметь шанс:
- уйти;
- спрятаться;
- использовать mobility.

---

# 86. Artillery impact

Impact presentation:

- bright flash;
- explosion;
- debris particles;
- smoke;
- shockwave ring;
- heavy sound;
- nearby screen/audio feedback.

Но:
- block damage = false;
- fire = false.

---

# 87. Artillery radius

Арена около 225x225.

Рекомендуемые значения:

- standard shell: 5-6 blocks;
- heavy shell: 7-8 blocks;
- absolute max rare event: ~10 blocks.

Не превращать один shell в половину Mid.

---

# 88. Cover-aware artillery damage

Для каждого игрока в radius:

1. взять impact point;
2. взять player bounding box;
3. построить несколько sample points:
   - head;
   - chest;
   - abdomen;
   - legs;
   - left shoulder;
   - right shoulder;
   - left edge;
   - right edge;
4. raycast impact -> sample;
5. вычислить Exposure.

Пример:

- 8/8 open = 1.00
- 4/8 = 0.50
- 0/8 = 0.00

Пример multiplier:

`ExposureMultiplier = 0.20 + 0.80 * Exposure`

Значит:
- fully open = 1.00x;
- half cover = 0.60x;
- full cover = 0.20x.

---

# 89. Cover-aware knockback

Knockback тоже уменьшается за стеной.

Пример:

`KnockbackMultiplier = 0.35 + 0.65 * Exposure`

Игрок за solid wall не должен улетать так, будто стены нет.

---

# 90. Artillery damage pipeline

Artillery не обязана создавать настоящий vanilla destructive explosion.

Лучше:

```text
Impact
-> visual explosion
-> CombatDamageService
-> type=ARTILLERY
-> tags=[EXPLOSIVE]
-> cover
-> armor
-> class modifiers
-> damage
-> knockback
-> killfeed
-> assists
```

ProtectionService:
- block destruction never happens.

---

# 91. RuntimeEntityRegistry

Центральный registry временных сущностей.

Каждая runtime entity имеет:

- runtimeEntityId;
- sessionId;
- owner;
- team;
- source ability/event;
- spawnTime;
- expiryTime;
- cleanup handler.

Типы:
- artillery shell;
- mine;
- sensor;
- smoke;
- barricade;
- temporary NPC;
- supply drop;
- special projectile;
- event object.

---

# 92. Runtime entity cleanup

При:

- STOP
- RESET
- FINISHED
- plugin disable

registry удаляет всё, связанное с session.

Никаких:
- старых mines;
- старых sensors;
- зависшего smoke;
- invisible ArmorStand;
- old BlockDisplay;
- dropped temporary Totems.

---

# 93. Lobby

В 0.15 можно включить полноценный `royale_lobby`.

Lobby:
- permanent world;
- Adventure;
- no PvP;
- no hunger;
- no damage;
- no build;
- no drop;
- no hostile mobs.

Используется:
- до матча;
- после матча;
- при reconnect routing;
- при Abort;
- при Finished.

---

# 94. Ready Room

`royale_ready`

Permanent.

Здесь:
- team confirmation;
- captain;
- bans;
- picks;
- ready;
- pre-match info.

После Draft:
- переход к Arena/Preparation.

---

# 95. Arena world lifecycle

`maps/royale_template`:
- clean template.

`royale_match`:
- disposable.

Никогда не редактировать template во время матча.

Copy:
- skip uid.dat;
- skip session.lock.

Reset:
- clean recreate.

---

# 96. Tournament Flow

К 0.15 плагин должен уметь провести нормальное мероприятие.

Lifecycle:

1. Lobby
2. Registration/roster
3. Ready Room
4. Captain
5. Bans
6. Picks
7. Ready
8. Arena load
9. Preparation
10. Match
11. Finish
12. Post-match summary
13. Audit/report
14. Return Lobby
15. Reset
16. Ready for second match

---

# 97. Spectator

Добавить Spectator role.

Spectator:
- не участник команды;
- не влияет на capture;
- не получает class;
- не триггерит traps;
- не получает normal damage;
- не может подбирать ресурсы;
- не может interact with objectives;
- не ломает карту.

Можно:
- fly;
- teleport players;
- view match info.

---

# 98. Referee

Referee role:

- наблюдает;
- pause/resume;
- audit view;
- inspect player;
- inspect inventory;
- inspect class;
- inspect cooldown;
- optional teleport;
- optional event control.

Referee не должен автоматически иметь destructive developer permissions.

---

# 99. Admin / Developer permissions

Разделить роли.

Пример LuckPerms groups:

- player
- captain
- spectator
- referee
- moderator
- admin
- developer

Plugin проверяет permission nodes, а не только OP.

---

# 100. LuckPerms integration

Пример nodes:

```text
royale.play
royale.captain
royale.spectate
royale.referee
royale.admin
royale.developer

royale.test.*
royale.audit.*
royale.setup.*
royale.match.*
```

---

# 101. TAB integration

TAB может показывать:

- player;
- team;
- class;
- captain;
- spectator/referee tag;
- match phase;
- optional score.

Не перегружать list.

---

# 102. Dynamic holograms

Голограммы только если полезны.

Примеры:

Generator:

```text
ГЕНЕРАТОР RED
Железо: 1/сек
Золото: 1/4 сек
```

Outpost:

```text
MID
BLUE
Захват RED: 64%
```

Quartermaster:

```text
КВАРТИРМЕЙСТЕР
ПКМ - снабжение
```

Holograms:
- dynamic;
- phase-aware;
- team-aware при возможности;
- cleanup-safe.

---

# 103. Telegram Bot

К 0.15 Telegram становится внешней панелью организатора.

Плагин остаётся source of truth.

Bot:
- получает status;
- отправляет authorized commands;
- не хранит главный state матча.

---

# 104. Telegram status

Пример:

```text
Minecraft Royale

Server: ONLINE
Match: WAR
Session: 4b8c1c0e
RED: 612
BLUE: 388
Players: 10/10
Event: Nightfall
Time: 31:44
Warnings: 0
```

---

# 105. Telegram controls

Минимум:

- Status
- Pause
- Resume
- Stop
- Players
- Score
- Phase
- Events
- Audit
- Report

Developer-only:
- Force Event
- Force Phase
- Test Clock
- Reset

---

# 106. Telegram safety

Все внешние команды:

- authentication;
- whitelist chat/user IDs;
- permission mapping;
- rate limit;
- confirmation for destructive actions;
- execute safely on server main thread.

Reset/Stop из Telegram:
- confirmation.

---

# 107. Command UX 0.15

Уйти от плоского command parsing.

Нужна context-aware command tree.

Autocomplete:
- знает branch;
- знает expected arg type;
- не предлагает `red/blue` там, где нужен class;
- не скрывает команды только потому, что current phase запрещает execution.

---

# 108. Canonical help

```text
/royale help
/royale help match
/royale help setup
/royale help test
/royale help audit
/royale help event
```

Help:
- short;
- contextual;
- examples;
- permission-aware.

---

# 109. Test commands - canonical tree

Рекомендуемый набор:

```text
/royale test clock ...
/royale test phase <phase>
/royale test score <red|blue> <value>
/royale test outpost <id> owner <team|neutral>
/royale test outpost <id> progress <value>

/royale test event list
/royale test event roll
/royale test event start <id>
/royale test event stop

/royale test class <player> <class>
/royale test ability <player> reset
/royale test ability <player> refill
/royale test cooldown clear <player>

/royale test generator <team> tick
/royale test generator <team> start
/royale test generator <team> stop

/royale test sudden start
/royale test sudden score <team> <value>
/royale test sudden time <duration>

/royale test finaldomination <red|blue>
```

---

# 110. Debug commands

```text
/royale debug phase
/royale debug clock
/royale debug escalation
/royale debug events
/royale debug combat <player>
/royale debug economy
/royale debug entities
/royale debug player <player>
```

Debug:
- immediate local state.

Audit:
- invariant-oriented diagnostic.

Не смешивать эти понятия.

---

# 111. Score invariants

Всегда:

`RED + BLUE = 1000`

Terminal:
- 1000/0;
- 0/1000.

Audit:
- 901 если сумма не 1000;
- 902 если terminal score достигнут, а матч не FINISHED.

---

# 112. Outpost reconciliation

OutpostService - source of truth.

HUD - presentation only.

Рекомендуется:
- регулярно пересчитывать occupants по реальным locations;
- всего 10 players x 3 regions, это дешёво.

HUD reconciliation:
- ~1/sec.

---

# 113. Fortress Protection

До Domination:
- enemy blocked.

Во время Domination:
- attacked fortress opens.

Broken:
- protection restores.

Final Domination:
- attacker access permanent until match end.

---

# 114. Core Item Integrity

TRUE CORE:

- нельзя drop;
- нельзя transfer;
- нельзя chest-store;
- нельзя dupe;
- нельзя loot from corpse.

Death:
- no duplicate;
- respawn restores missing core.

Audit:
- 804 CORE_ITEM_DUPLICATION.

---

# 115. Class consumables

Class consumable:

- может drop;
- может loot;
- имеет stock;
- имеет periodic supply;
- death не создаёт бесплатный refill;
- enemy pickup не даёт class ownership или future supply.

---

# 116. Event and phase cleanup

Каждый event обязан иметь explicit cleanup.

Phase exit обязан:
- снять temporary modifiers;
- остановить relevant schedulers;
- убрать временные entities;
- reconciliate baseline.

Reset:
- глобальный cleanup.

---

# 117. Scheduler lifecycle

Все repeating tasks должны иметь owner.

Нельзя оставлять anonymous BukkitRunnable без lifecycle.

Каждый task:
- session ID;
- subsystem ID;
- cancel on stop;
- pause semantics;
- reset semantics.

Audit должен видеть orphan scheduler, если возможно.

---

# 118. Config versioning

Добавить `config-version`.

При load:
- validate;
- warn deprecated keys;
- fail-safe defaults;
- не молча игнорировать критический invalid config.

Нужные конфиги можно разделить:

- `config.yml`
- `map.yml`
- `classes.yml`
- `events.yml`
- `economy.yml`
- `balance.yml`
- `telegram.yml`
- `audit.yml`

---

# 119. Map validation

`/royale setup validate`

Проверяет:

- template exists;
- Arena Boundary;
- RED/BLUE spawn;
- RED/BLUE fortress;
- all 3 outposts;
- RED/BLUE Command Point;
- generators;
- Quartermaster anchors;
- no invalid overlaps;
- all coordinates in correct world.

---

# 120. Match start validation

Перед Production Start:

- map valid;
- no second session;
- teams valid;
- required players/config;
- class system available;
- worlds loaded;
- no critical audit failures.

Если critical:
- start rejected.

---

# 121. Production vs Test

PRODUCTION:
- strict rules;
- no arbitrary class switch;
- no arbitrary team switch;
- timers authoritative;
- tournament-safe.

TEST:
- flexible;
- clock control;
- force;
- audit;
- telemetry;
- sandbox.

Режим должен быть явно виден admin HUD/log.

---

# 122. Performance

0.15 огромный, поэтому нужно контролировать:

- Item entities generators;
- particles;
- BlockDisplay artillery;
- raycasts;
- telemetry writes;
- audit checks;
- holograms.

Не делать тяжёлый full-world scan каждый tick.

---

# 123. Artillery performance

Cover raycast делать только:
- игрокам в effective radius;
- в момент impact;
- 6-8 rays/player.

Максимум 10 игроков.
Это дёшево.

---

# 124. Telemetry performance

Не писать файл на каждый hit.

Использовать:
- in-memory aggregation;
- batch flush;
- report at match end;
- periodic safe flush.

---

# 125. Audit performance

Heavy invariant checks:
- не каждый tick;
- interval 1s/5s в зависимости от subsystem.

CRITICAL lightweight invariants можно чаще.

---

# 126. Match Cleanup Service

Единая точка cleanup для:

- STOP;
- RESET;
- FINISHED;
- plugin disable.

Чистит:

- teams;
- captains;
- ready;
- classes;
- cooldowns;
- effects;
- disguises;
- marks;
- event state;
- runtime entities;
- scoreboard;
- bossbars;
- sidebar;
- holograms;
- generator items;
- temporary Totems;
- spectator temp state;
- Telegram session bindings.

---

# 127. Second-match gate

После завершения матча:

1. FINISHED.
2. return Lobby.
3. report.
4. reset.
5. recreate `royale_match`.
6. start new session.
7. no Paper restart.

Проверить:
- player state;
- world state;
- entities;
- score;
- events;
- cooldowns;
- classes;
- Telegram;
- TAB;
- holograms.

---

# 128. Historical regressions - never return

0.15 не принимается, если вернулся любой старый критический баг:

- score 1000 не завершает;
- premature Final Domination;
- score не движется;
- Bombardier core weapon не работает;
- Core Items теряются/дюпаются;
- Fortress Protection broken;
- defenders cannot recapture;
- Event ломает capture;
- stale team after reset;
- wrong command autocomplete;
- Sidebar flicker;
- stale runtime in second match.

---

# 129. Outpost Shutdown regression gate

Сценарий:

1. Игрок BLUE находится в Mid.
2. Идёт capture.
3. Force `Outpost Shutdown` на Blue Line.
4. Mid не должен:
   - reset;
   - freeze;
   - disappear;
   - stop HUD.
5. После event end всё корректно.

---

# 130. Audit regression gate

Если возникает намеренно сломанный test-state:

- Audit должен поймать;
- код стабильный;
- compact export читаемый;
- fingerprint работает;
- report сохраняется.

---

# 131. MRP regression gate

Для каждого класса:
- Total MRP;
- scenario profile;
- source breakdown;
- TTK data link.

Нельзя принимать класс с "100 MRP" без расчёта breakdown.

---

# 132. Class audit

Каждый из 16:

- spawn;
- primary;
- signature;
- utility;
- passive;
- cooldown;
- consumables;
- death;
- respawn;
- drop rules;
- escalation modifiers;
- event interaction;
- Reset cleanup;
- second-match;
- telemetry;
- MRP.

---

# 133. Economy audit

Тест:

WAR 20 sec:
- Coal ~20;
- Iron ~4;
- Gold ~2.

Pause:
- count freezes.

Esc I:
- rates update.

Esc II:
- diamonds appear.

Final:
- Diamond 1/sec;
- Netherite Block after ~60 sec.

No entity flood.

---

# 134. Vendor audit

Проверить:

- GUI;
- correct team;
- insufficient resources;
- atomic purchase;
- double click;
- reconnect;
- respawn;
- team armor upgrade;
- class ammo;
- endgame;
- Reset cleanup.

---

# 135. Escalation audit

Esc I:
- title;
- refill;
- supply x0.75;
- cooldown x0.90;
- economy;
- event intensity.

Esc II:
- score x2;
- capture 35;
- diamonds;
- refill;
- cooldown x0.80.

Final:
- score x3;
- capture 30;
- supply x0.33;
- cooldown x0.70;
- endgame economy;
- class variants.

---

# 136. Sudden audit

- frozen main score;
- only Mid;
- 0/100;
- +1 / 6 sec;
- 60 sec uncontested ≈ 10 points;
- hard 600 sec;
- no overtime;
- tie-break deterministic;
- winner attacker.

---

# 137. Final Domination audit

- no Broken;
- 2-1 = +5/sec;
- 3-0 = +15/sec;
- Command Point 90 sec;
- attacker respawn 26;
- defender penalty grows;
- Pause stops penalty progression.

---

# 138. Event audit

Force-test минимум:

- Nightfall;
- Artillery Strike;
- Storm;
- Outpost Shutdown;
- Supply Drop;
- Generator Overload;
- Second Chance;
- Null Zone;
- Supply Surge;
- Low Gravity;
- Gold Rush;
- TNT Supply;
- Blackout;
- War Fog.

Для каждого:
- start;
- active;
- end;
- Pause;
- Reset;
- second match.

---

# 139. Artillery audit

Проверить:

- warning;
- visible shell;
- high-speed descent;
- collision;
- impact;
- particles;
- sound;
- no block destruction;
- radius;
- damage;
- cover reduction;
- knockback reduction;
- killfeed;
- assists;
- cleanup.

---

# 140. Test Clock audit

Проверить:

- static;
- start;
- stop;
- add;
- subtract;
- set;
- seek forward;
- seek backward;
- phase crossing;
- no duplicate entry reward;
- correct HUD;
- correct generator;
- correct vendor;
- correct event profile.

---

# 141. Telegram audit

Проверить:

- unauthorized user rejected;
- status;
- pause;
- resume;
- audit;
- event;
- reset confirmation;
- network error does not crash plugin;
- Telegram unavailable does not stop Minecraft server.

---

# 142. Spectator/referee audit

Spectator:
- no capture;
- no resource pickup;
- no trap trigger;
- no damage contribution.

Referee:
- correct permissions;
- audit available;
- no accidental destructive developer access.

---

# 143. TAB/LuckPerms audit

Проверить:
- groups;
- prefixes;
- team/class display;
- permission enforcement;
- second match;
- reconnect.

---

# 144. Hologram audit

Проверить:
- correct team;
- correct phase;
- update;
- no duplicates;
- no stale holograms after Reset.

---

# 145. Reconnect behavior

Игрок disconnect/reconnect:

До матча:
- Lobby/Ready Room routing.

Во время матча:
- restore team/class/state;
- combat logout penalty if tagged;
- no duplicate core items;
- no duplicate essentials;
- correct HUD.

После Finish:
- Lobby.

---

# 146. Error handling

Любая внешняя ошибка должна быть понятной.

Не писать:
`Something went wrong`.

Лучше:
`409 STATE_CONFLICT - Cannot start Final Domination while Sudden Royale is unresolved.`

Внутри:
- Audit code;
- readable admin message;
- log details.

---

# 147. Known limitations допустимы

0.15 может иметь documented limitations, если они:

- не ломают match;
- не вызывают dupe;
- не ломают reset;
- не ломают score;
- не ломают phases;
- не ломают server stability.

Known limitations обязательно перечислить в release report.

---

# 148. Что не делать в 0.15 ради галочки

Не добавлять:
- filler events;
- случайные новые классы;
- ranked;
- database ради database;
- сложный matchmaking;
- monetization;
- cosmetics store;
- giant anti-cheat platform;
- новые special locations без готовой карты.

0.15 про завершение ядра.

---

# 149. Special Locations

Архитектурные hooks можно подготовить.

Но реальные:
- factory;
- hospital;
- radar;
- artillery battery;
- special mine;
- bunker

не обязательны, пока не построены на Арене.

---

# 150. Feature Freeze после 0.15

После выдачи `0.15.0`:

- никакого нового большого content;
- сначала Final Acceptance.

Все найденные проблемы:
- собираются в один backlog.

Следующая версия:

## 0.15.1 FINAL STABILIZATION

Только:
- bug fixes;
- balance corrections;
- config fixes;
- UX fixes;
- performance fixes;
- audit fixes.

---

# 151. Final Acceptance Protocol

После 0.15 создать отдельный большой документ:

`MINECRAFT_ROYALE_FINAL_ACCEPTANCE.md`

Ориентир:
- 150-250 checks.

Проверка от:
- clean install

до:
- second full match without Paper restart.

---

# 152. Deliverables 0.15

Обязательные:

- `MinecraftRoyale-0.15.0-SNAPSHOT.jar`
- source code
- updated configs
- `CHANGELOG_0.15.md`
- `AUDIT_CODES.md`
- `MRP_BALANCE_LEDGER.md`
- `COMMANDS_0.15.md`
- `FINAL_ACCEPTANCE_DRAFT.md`
- known limitations
- architecture summary
- tested list

Желательно:
- `ttk-matrix.csv`
- `matchup-matrix.csv`
- `role-matrix.csv`
- example audit report
- example match report

---

# 153. Release report

Разработчик должен выдать итоговый отчёт:

## AUDIT
Что было найдено в исходной базе.

## REFACTORED
Что было перестроено.

## TEST LAB
Что реализовано по clock/seek.

## AUDIT ENGINE
Коды, команды, export.

## MRP
Как работает ledger.

## TELEMETRY
Что собирается.

## COMBAT
Изменения PvP.

## CLASSES
Статус всех 16.

## ESCALATION
Что реально меняется.

## EVENTS
Полный список.

## ECONOMY
Generator + Vendor.

## ARTILLERY
Visual/cover/damage.

## INFRASTRUCTURE
Worlds/permissions/TAB/holograms/Telegram.

## TESTED
Что проверено автоматически/smoke.

## KNOWN LIMITATIONS
Что осталось.

---

# 154. Критерий "0.15 готов"

0.15 считается готовой только если:

- clean build;
- Paper 1.20.1 starts;
- `royale_template` safe;
- `royale_match` creates;
- MatchClock works;
- seek works;
- Audit works;
- score invariant works;
- all 16 classes load;
- MRP ledger exists;
- telemetry writes;
- generators work;
- Vendor works;
- events work;
- artillery works;
- Sudden works;
- Final Domination works;
- Lobby/Ready work;
- spectator/referee work;
- Telegram layer does not crash server;
- Reset works;
- second match works.

---

# 155. Главная дизайнерская цель

После 0.15 игрок должен запоминать не:

> "я ударил его алмазным мечом"

а:

> "Разведчик вылетел вверх на Signal Burst, Диверсант заминировал проход, Один пережил смертельный удар через Valhalla, Бомбардир разорвал позицию Airburst, а Тимлид накрыл отступление артиллерией, и всё это произошло во время перехода в Полную мобилизацию".

Это главный критерий того, что Minecraft Royale действительно стал отдельной игрой, а не набором команд поверх Minecraft.

---

# 156. Итог

0.15.0 - это не "ещё один патч".

Это версия, которая должна собрать Minecraft Royale в единый продукт:

- игра;
- тестовая лаборатория;
- диагностическая система;
- балансировочная система;
- турнирный runtime;
- визуальный спектакль;
- инфраструктура организатора.

После этого мы перестаём бесконечно добавлять новое и проводим один большой тест всей системы целиком.

Следующий шаг после 0.15.0:

**0.15.1 FINAL STABILIZATION - fixes only.**
