import { useState } from 'react'
import { SkillDrawer } from '@TAF/components/Skills/SkillDrawer'
import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material'
import { Lock as LockIcon, Add as AddIcon } from '@mui/icons-material'
import {
  Box,
  Chip,
  List,
  Menu,
  Button,
  MenuItem,
  ListItem,
  Accordion,
  Typography,
  IconButton,
  ListItemText,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material'
import { Delete as DeleteIcon } from '@mui/icons-material'

export type TSkillLinkItem = {
  id: string
  name: string
  description?: string
  alwaysActive?: boolean
}

export type TSandboxSkillsAccordionProps = {
  orgId: string
  loading: boolean
  disabled: boolean
  projectId?: string
  orgSkills: TSkillLinkItem[]
  projectSkills: TSkillLinkItem[]
  availableSkills: TSkillLinkItem[]
  onAddSkill: (skill: TSkillLinkItem) => void
  onRemoveSkill: (skillId: string) => void
  onSkillCreated?: (skillId: string) => void
}

export const SandboxSkillsAccordion = (props: TSandboxSkillsAccordionProps) => {
  const {
    orgId,
    disabled,
    projectId,
    orgSkills,
    projectSkills,
    availableSkills,
    onAddSkill,
    onRemoveSkill,
    onSkillCreated,
  } = props

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [expanded, setExpanded] = useState(false)
  const [skillDrawerOpen, setSkillDrawerOpen] = useState(false)

  const isProjectContext = !!projectId
  const editableSkills = isProjectContext ? projectSkills : orgSkills
  const hasOrgSkills = isProjectContext && orgSkills.length > 0

  return (
    <>
      <Accordion
        expanded={expanded}
        onChange={(_, isExpanded) => setExpanded(isExpanded)}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography
            fontWeight={500}
            variant='subtitle1'
          >
            Skills
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {hasOrgSkills && (
              <Box sx={{ mb: 1 }}>
                <Typography
                  variant='caption'
                  color='text.secondary'
                  sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}
                >
                  <LockIcon sx={{ fontSize: 14 }} />
                  Organization skills (read-only)
                </Typography>
                <List
                  dense
                  disablePadding
                  sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}
                >
                  {orgSkills.map((skill) => (
                    <ListItem
                      key={skill.id}
                      sx={(theme) => ({
                        px: 1.5,
                        opacity: 0.7,
                        borderRadius: `6px`,
                        backgroundColor: theme.palette.background.input,
                        border: `1px solid ${theme.palette.border?.default}`,
                      })}
                    >
                      <ListItemText
                        primary={skill.name}
                        secondary={skill.description || null}
                        primaryTypographyProps={{ variant: 'body2' }}
                        secondaryTypographyProps={{ variant: 'caption', noWrap: true }}
                      />
                      {skill.alwaysActive && (
                        <Chip
                          size='small'
                          label='Active'
                          color='success'
                          variant='outlined'
                          sx={{ ml: 1 }}
                        />
                      )}
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}

            {isProjectContext && hasOrgSkills && editableSkills.length > 0 && (
              <Typography
                variant='caption'
                color='text.secondary'
                sx={{ mt: 0.5 }}
              >
                Project skills
              </Typography>
            )}

            {editableSkills.length > 0 && (
              <List
                dense
                disablePadding
                sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}
              >
                {editableSkills.map((skill) => (
                  <ListItem
                    key={skill.id}
                    sx={(theme) => ({
                      px: 1.5,
                      borderRadius: `6px`,
                      backgroundColor: theme.palette.background.input,
                      border: `1px solid ${theme.palette.border?.default}`,
                    })}
                    secondaryAction={
                      <IconButton
                        edge='end'
                        size='small'
                        disabled={disabled}
                        onClick={() => onRemoveSkill(skill.id)}
                        sx={{ '&:hover': { color: 'error.main' } }}
                      >
                        <DeleteIcon fontSize='small' />
                      </IconButton>
                    }
                  >
                    <ListItemText
                      primary={skill.name}
                      secondary={skill.description || null}
                      primaryTypographyProps={{ variant: 'body2' }}
                      secondaryTypographyProps={{ variant: 'caption', noWrap: true }}
                    />
                    {skill.alwaysActive && (
                      <Chip
                        size='small'
                        label='Active'
                        color='success'
                        variant='outlined'
                        sx={{ ml: 1, mr: 4 }}
                      />
                    )}
                  </ListItem>
                ))}
              </List>
            )}

            {!editableSkills.length && !hasOrgSkills && (
              <Typography
                variant='body2'
                color='text.secondary'
              >
                No skills assigned. Skills are injected as files into the sandbox when it
                starts.
              </Typography>
            )}

            <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
              <Button
                size='small'
                variant='outlined'
                disabled={disabled || !availableSkills.length}
                startIcon={<AddIcon />}
                onClick={(e) => setAnchorEl(e.currentTarget)}
              >
                Add Skill
              </Button>
              <Button
                size='small'
                variant='text'
                disabled={disabled}
                onClick={() => setSkillDrawerOpen(true)}
              >
                Create New
              </Button>
            </Box>

            <Menu
              anchorEl={anchorEl}
              open={!!anchorEl}
              onClose={() => setAnchorEl(null)}
            >
              {availableSkills.map((skill) => (
                <MenuItem
                  key={skill.id}
                  onClick={() => {
                    onAddSkill(skill)
                    setAnchorEl(null)
                  }}
                >
                  <ListItemText
                    primary={skill.name}
                    secondary={skill.description || null}
                    primaryTypographyProps={{ variant: 'body2' }}
                    secondaryTypographyProps={{ variant: 'caption' }}
                  />
                </MenuItem>
              ))}
            </Menu>
          </Box>
        </AccordionDetails>
      </Accordion>

      <SkillDrawer
        orgId={orgId}
        open={skillDrawerOpen}
        onClose={() => setSkillDrawerOpen(false)}
        onCreated={(skillId) => {
          onSkillCreated?.(skillId)
          setSkillDrawerOpen(false)
        }}
      />
    </>
  )
}
