from fantsu.judging import EventFilter

class PriorityFilter(EventFilter):

    def __init__(self, *flts):
        super().__init__()
        self._filters = flts

    def filter(self, ej):
        return any(f(ej) for f in self._filters)

    def select_active(self, ejs):
        for f in self._filters:
            if self.active is not None and f(self.active):
                return self.active
            for ej in ejs:
                if f(ej):
                    return ej

prio = PriorityFilter

def arena(*arenas):
    arenas = set(arenas)
    return lambda ej: ej.event.arena in arenas

def block(*blocks):
    blocks = set(block)
    return lambda ej: ej.event.block_id in blocks

def team(*team_ids):
    team_ids = set(team_ids)
    return lambda ej: any(tid in team_ids for tid in ej.event.team_ids)

def judge(*judge_ids):
    judge_ids = set(judge_ids)
    return lambda ej: ej.judge.id in judge_ids

def any_(*flts):
    return lambda ej: any(f(ej) for f in flts)

def all_(*flts):
    return lambda ej: all(f(ej) for f in flts)

def from_dict(d):
    flts = []

    if "arena" in d:
        flts.append(arena(d["arena"]))
    if "block" in d:
        flts.append(block(d["block"]))
    if "team" in d:
        flts.append(team(map(int, d["team"])))
    if "judge" in d:
        flts.append(judge(map(int, d["judge"])))

    return any_(*flts)

def from_list(l):
    return prio(list(map(from_dict, l)))
