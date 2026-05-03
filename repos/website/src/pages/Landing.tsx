import Hero from '@TAF/components/Landing/Hero'
import Pricing from '@TAF/components/Landing/Pricing'
import PageMeta from '@TAF/components/Shared/PageMeta'
import UseCases from '@TAF/components/Landing/UseCases'
import Features from '@TAF/components/Landing/Features'
import CTABanner from '@TAF/components/Landing/CTABanner'
import HowItWorks from '@TAF/components/Landing/HowItWorks'
import CodePreview from '@TAF/components/Landing/CodePreview'

/**
  * TODO: Commenting out for now. Need to get real testimonials
  * Add back in once we have those
  import Testimonials from '@TAF/components/Landing/Testimonials'
 */

const Landing = () => (
  <>
    <PageMeta description='Threaded Stack provides secure, managed sandbox environments for AI agents and tools. Run Claude Code, Codex, OpenCode, or Gemini CLI with zero-trust credential management and centralized team configuration.' />
    <Hero />
    <Features />
    <HowItWorks />
    <CodePreview />
    <Pricing />
    <UseCases />
    <CTABanner />
  </>
)

export default Landing
