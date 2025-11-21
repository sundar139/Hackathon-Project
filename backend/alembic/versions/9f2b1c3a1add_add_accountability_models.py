"""Add AccountabilityPair and PairNudge models

Revision ID: 9f2b1c3a1add
Revises: 51adf212bed1
Create Date: 2025-11-21 19:10:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9f2b1c3a1add'
down_revision: Union[str, Sequence[str], None] = '51adf212bed1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'accountability_pairs',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('user_a_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('user_b_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('weekly_checkins', sa.Integer(), server_default='1'),
        sa.Column('active', sa.Boolean(), server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_accountability_pairs_id', 'accountability_pairs', ['id'])
    op.create_index('ix_accountability_pairs_user_a_id', 'accountability_pairs', ['user_a_id'])
    op.create_index('ix_accountability_pairs_user_b_id', 'accountability_pairs', ['user_b_id'])

    op.create_table(
        'pair_nudges',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('pair_id', sa.Integer(), sa.ForeignKey('accountability_pairs.id'), nullable=False),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('content', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_pair_nudges_id', 'pair_nudges', ['id'])
    op.create_index('ix_pair_nudges_pair_id', 'pair_nudges', ['pair_id'])
    op.create_index('ix_pair_nudges_user_id', 'pair_nudges', ['user_id'])


def downgrade() -> None:
    op.drop_index('ix_pair_nudges_user_id', table_name='pair_nudges')
    op.drop_index('ix_pair_nudges_pair_id', table_name='pair_nudges')
    op.drop_index('ix_pair_nudges_id', table_name='pair_nudges')
    op.drop_table('pair_nudges')

    op.drop_index('ix_accountability_pairs_user_b_id', table_name='accountability_pairs')
    op.drop_index('ix_accountability_pairs_user_a_id', table_name='accountability_pairs')
    op.drop_index('ix_accountability_pairs_id', table_name='accountability_pairs')
    op.drop_table('accountability_pairs')