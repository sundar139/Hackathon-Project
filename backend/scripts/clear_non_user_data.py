from pathlib import Path
import sys

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.db.session import SessionLocal
from app.models import (
    assignment,
    schedule,
    mood,
    peer_group,
    chat,
    intervention,
    suggestion,
    goal,
    activity,
)


def clear_non_user_data():
    db = SessionLocal()
    try:
        db.query(schedule.ScheduleBlock).delete(synchronize_session=False)
        db.query(assignment.Subtask).delete(synchronize_session=False)
        db.query(goal.GoalSession).delete(synchronize_session=False)
        db.query(peer_group.GroupMessage).delete(synchronize_session=False)
        db.query(peer_group.GroupMember).delete(synchronize_session=False)
        db.query(intervention.InterventionSession).delete(synchronize_session=False)
        db.query(chat.ChatSession).delete(synchronize_session=False)
        db.query(activity.ActivitySession).delete(synchronize_session=False)
        db.query(suggestion.WellbeingSuggestion).delete(synchronize_session=False)
        db.query(mood.MoodCheckin).delete(synchronize_session=False)

        db.query(assignment.Assignment).delete(synchronize_session=False)
        db.query(assignment.Course).delete(synchronize_session=False)
        db.query(goal.Goal).delete(synchronize_session=False)
        db.query(peer_group.PeerGroup).delete(synchronize_session=False)
        db.query(intervention.Intervention).delete(synchronize_session=False)

        db.commit()
        print("Cleared all non-user data successfully")
    except Exception as e:
        db.rollback()
        print(f"Failed to clear non-user data: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    clear_non_user_data()