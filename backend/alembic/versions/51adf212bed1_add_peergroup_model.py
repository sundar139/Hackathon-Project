"""Add PeerGroup model

Revision ID: 51adf212bed1
Revises: a8853b1bdc0d
Create Date: 2025-11-19 18:18:24.679014

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '51adf212bed1'
down_revision: Union[str, Sequence[str], None] = 'a8853b1bdc0d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'peer_groups',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('description', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_peer_groups_id', 'peer_groups', ['id'])
    op.create_index('ix_peer_groups_name', 'peer_groups', ['name'])

    op.create_table(
        'group_members',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('group_id', sa.Integer(), sa.ForeignKey('peer_groups.id'), nullable=False),
        sa.Column('joined_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_group_members_id', 'group_members', ['id'])
    op.create_index('ix_group_members_group_id', 'group_members', ['group_id'])
    op.create_index('ix_group_members_user_id', 'group_members', ['user_id'])

    op.create_table(
        'group_messages',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('group_id', sa.Integer(), sa.ForeignKey('peer_groups.id'), nullable=False),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('content', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_group_messages_id', 'group_messages', ['id'])
    op.create_index('ix_group_messages_group_id', 'group_messages', ['group_id'])
    op.create_index('ix_group_messages_user_id', 'group_messages', ['user_id'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_group_messages_user_id', table_name='group_messages')
    op.drop_index('ix_group_messages_group_id', table_name='group_messages')
    op.drop_index('ix_group_messages_id', table_name='group_messages')
    op.drop_table('group_messages')

    op.drop_index('ix_group_members_user_id', table_name='group_members')
    op.drop_index('ix_group_members_group_id', table_name='group_members')
    op.drop_index('ix_group_members_id', table_name='group_members')
    op.drop_table('group_members')

    op.drop_index('ix_peer_groups_name', table_name='peer_groups')
    op.drop_index('ix_peer_groups_id', table_name='peer_groups')
    op.drop_table('peer_groups')
