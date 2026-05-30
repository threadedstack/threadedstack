import Hero from '@TAF/components/Landing/Hero'
import Pricing from '@TAF/components/Landing/Pricing'
import PageMeta from '@TAF/components/Shared/PageMeta'
import UseCases from '@TAF/components/Landing/UseCases'
import Features from '@TAF/components/Landing/Features'
import CTABanner from '@TAF/components/Landing/CTABanner'
import HowItWorks from '@TAF/components/Landing/HowItWorks'
import CodePreview from '@TAF/components/Landing/CodePreview'
import AgentStrip from '@TAF/components/Landing/AgentStrip'
import ProblemStatement from '@TAF/components/Landing/ProblemStatement'

/**
  * TODO: Commenting out for now. Need to get real testimonials
  * Add back in once we have those
  import Testimonials from '@TAF/components/Landing/Testimonials'
 */

const Landing = () => (
  <>
    <PageMeta description='Threaded Stack provides secure, managed sandbox environments for AI tools. Run Claude Code, Codex, OpenCode, Antigravity, or OpenClaw with zero-trust credential management and centralized team configuration.' />
    <Hero />
    <AgentStrip />
    <ProblemStatement />
    <Features />
    <HowItWorks />
    <CodePreview />
    <Pricing />
    <UseCases />
    <CTABanner />
  </>
)

export default Landing
